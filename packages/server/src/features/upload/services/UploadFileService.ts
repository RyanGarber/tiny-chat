import { createId } from "@paralleldrive/cuid2";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { unzipSync } from "fflate";
import sharp from "sharp";
import { Prisma } from "../../../../generated/prisma/client.ts";
import type {
	UploadCreateInput,
	UploadWhereInput,
} from "../../../../generated/prisma/models/Upload.ts";
import { UploadUtils } from "../utils/UploadUtils.ts";

export type UploadCreateOptions = Partial<
	Pick<UploadCreateInput, "name" | "type" | "thumbnail">
>;

/**
 * File preprocessing and upload handling.
 */
export const UploadFileService = {
	/**
	 * Unzip a zip file and upload its contents.
	 */
	uploadZip: async ({
		user,
		zip,
		create,
		connect,
		include,
		skipRoot,
	}: {
		user: zUser;
		zip: [string, ArrayBufferLike][] | ArrayBufferLike;
		create?: UploadCreateOptions;
		connect?: UploadWhereInput;
		include?: (path: string) => boolean;
		skipRoot?: boolean;
	}) => {
		if (Array.isArray(zip)) zip = zip[0][1];

		const unzipped = unzipSync(new Uint8Array(zip));
		console.log(`unzipped ${Object.keys(unzipped).length} files`);

		const files = Object.entries(unzipped).filter(([path]) =>
			UploadUtils.shouldIncludeFile({ path: path, extras: false }),
		);

		return await UploadFileService.upload({
			user,
			create,
			files: files.map(([name, data]) => [
				name
					.split("/")
					.slice(skipRoot ? 1 : 0)
					.join("/"),
				data.buffer,
			]),
			connect,
			include,
		});
	},

	/**
	 * Upload files, incrementally updating existing ones.
	 */
	upload: async ({
		user,
		files,
		create,
		connect,
		include,
	}: {
		user: zUser;
		files: [string, ArrayBufferLike][];
		create?: UploadCreateOptions;
		connect?: UploadWhereInput;
		include?: (path: string) => boolean;
	}) => {
		const existing = connect
			? await globalThis.prisma.upload.findFirst({
					where: { userId: user.id, ...connect },
					include: { files: true },
				})
			: null;

		const paths = new Set<string>();
		const toCreate: { path: string[]; mime: string; data: Uint8Array }[] = [];
		const toUpdate: { id: string; data: Uint8Array; mime: string }[] = [];

		let name: string | undefined;
		let thumbnail: Uint8Array<ArrayBuffer> | undefined;

		for (let [path, content] of files) {
			path = path
				.replace(/\s/g, " ")
				.split("/")
				.filter((part) => part.trim().length)
				.join("/");

			if (include && !include(path)) {
				console.log(`skipping file ${path} because of include result`);
				continue;
			}

			if (
				!path.length ||
				path.endsWith("/") ||
				!Buffer.from(content).byteLength
			) {
				console.log(`skipping file ${path} because it is a directory`);
				continue;
			}

			console.log(`preprocessing file ${path}`);

			paths.add(path);

			const existingFile = existing?.files.find((file) =>
				PathUtils.equals(file.path, path),
			);

			const preprocessed = await UploadFileService._preprocess({
				data: Buffer.from(content),
				filename: PathUtils.name({ path }),
			});
			if (!preprocessed) throw new Error(`Failed to preprocess file ${path}`);

			console.log(`preprocessed file ${path}:`, {
				...preprocessed,
				data: `${preprocessed.data.length} bytes`,
			});

			if (!existingFile) {
				toCreate.push({
					path: path.split("/"),
					mime: preprocessed.mime,
					data: preprocessed.data,
				});
			} else if (
				Buffer.compare(Buffer.from(existingFile.data), Buffer.from(content)) !==
				0
			) {
				toUpdate.push({
					id: existingFile.id,
					data: preprocessed.data,
					mime: preprocessed.mime,
				});
			}

			name ??= PathUtils.name({ path });
			thumbnail ??= preprocessed.thumbnail;
		}

		const toDelete =
			existing?.files
				.filter((file) => !paths.has(file.path.join("/")))
				.map((file) => file.id) ?? [];

		console.log(
			`${toCreate.length} to create, ${toUpdate.length} to update, ${toDelete.length} to delete`,
		);

		const uploadId = existing?.id ?? createId();
		const upload = await globalThis.prisma.upload.upsert({
			where: { id: uploadId },
			create: {
				id: uploadId,
				user: { connect: { id: user.id } },
				name: name ?? "",
				thumbnail,
				...create,
			},
			update: {
				createdAt: new Date(),
				...create,
			},
		});

		// TODO - no transaction due to timeouts
		await Promise.all([
			...toCreate.map((file) =>
				globalThis.prisma.file.create({
					data: {
						id: createId(),
						user: { connect: { id: user.id } },
						upload: { connect: { id: upload.id } },
						path: file.path,
						mime: file.mime,
						data: new Uint8Array(file.data),
					},
				}),
			),
			...toUpdate.map((file) =>
				globalThis.prisma.file.update({
					where: { id: file.id },
					data: {
						data: new Uint8Array(file.data),
						mime: file.mime,
					},
				}),
			),
			...toDelete.map((id) =>
				globalThis.prisma.file.delete({
					where: { id },
				}),
			),
		]);

		if (toUpdate.length > 0) {
			await globalThis.prisma
				.$executeRaw`UPDATE file SET embedding = NULL WHERE id IN (${Prisma.join(toUpdate.map((file) => file.id))})`;
		}

		return upload;
	},

	/**
	 * Compress images and prepare a thumbnail.
	 *
	 * Everything else is stored exactly as it arrived. Documents used to be
	 * converted to markdown here, which meant the stored file was no longer the
	 * file the user sent; they are now unpacked when something reads one, by
	 * `FileExtractionService`.
	 */
	_preprocess: async ({
		data,
		filename,
		fallbackMime,
	}: {
		data: Buffer;
		filename: string;
		fallbackMime?: string;
	}) => {
		let thumbnail: Uint8Array<ArrayBuffer> | undefined;
		let mime =
			(await FileTypeUtils.getMime({
				data,
				path: filename,
				fallback: fallbackMime,
			})) ?? "application/octet-stream";

		console.log(`preprocessing file: ${filename} (${mime})`);
		if (
			mime.includes("image/") &&
			["png", "jpg", "jpeg", "gif", "webp", "avif", "tiff", "svg"].some(
				(type) => mime.includes(type),
			)
		) {
			try {
				mime = "image/webp";
				data = await sharp(data, { failOn: "none", animated: true })
					.resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
					.webp({ quality: 80 })
					.toBuffer();
				thumbnail = await sharp(data, { failOn: "none" })
					.resize(256, 256, { fit: "inside", withoutEnlargement: true })
					.webp({ quality: 20 })
					.toBuffer();
				console.log(
					`optimized image: ${data.byteLength}B (thumbnail: ${thumbnail.length})`,
				);
			} catch (e) {
				console.error(e);
				throw e;
			}
		}

		return { data, mime, thumbnail };
	},
} as const;
