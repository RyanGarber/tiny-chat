import type { Enum } from "@tiny-chat/core/src/core/services/PostgresService.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { FileTypeUtils } from "@tiny-chat/core/src/features/file/utils/FileTypeUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { unzipSync } from "fflate";
import sharp from "sharp";
import { selectAll } from "../../../db.ts";
import { UploadUtils } from "../utils/UploadUtils.ts";

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
		kind,
		include,
		skipRoot,
		replaceName,
	}: {
		user: zUser;
		zip: [string, ArrayBufferLike][] | ArrayBufferLike;
		kind: Enum["UploadKind"];
		include?: (path: string) => boolean;
		skipRoot?: boolean;
		replaceName?: string;
	}) => {
		if (Array.isArray(zip)) zip = zip[0][1];

		const unzipped = unzipSync(new Uint8Array(zip));
		console.log(`unzipped ${Object.keys(unzipped).length} files`);

		const files = Object.entries(unzipped).filter(([path]) =>
			UploadUtils.shouldIncludeFile({ path: path, extras: false }),
		);

		return await UploadFileService.upload({
			user,
			kind,
			replaceName,
			files: files.map(([name, data]) => [
				name
					.split("/")
					.slice(skipRoot ? 1 : 0)
					.join("/"),
				data.buffer,
			]),
			include,
		});
	},

	/**
	 * Upload files, incrementally updating existing ones.
	 */
	upload: async ({
		user,
		files,
		kind,
		include,
		replaceName,
	}: {
		user: zUser;
		files: [string, ArrayBufferLike][];
		kind: Enum["UploadKind"];
		name?: string;
		include?: (path: string) => boolean;
		replaceName?: string;
	}) => {
		const existing = replaceName
			? (
					await globalThis.db.orm.public.Upload.where({
						userId: user.id,
						kind,
						name: replaceName,
					})
						.include("files", (file) => selectAll(file, "public", "File"))
						.all()
				)[0]
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
				PathUtils.equals([...file.path], path),
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

		const uploadId = existing?.id ?? CommonUtils.getRandomId();

		const upload = await globalThis.db.orm.public.Upload.where({
			id: uploadId,
		}).upsert({
			create: {
				id: uploadId,
				userId: user.id,
				name: replaceName ?? name ?? "",
				thumbnail,
				kind,
			},
			update: {
				createdAt: Temporal.Now.plainDateTimeISO("UTC"),
				kind,
			},
		});

		// TODO - no transaction due to timeouts
		await Promise.all([
			...toCreate.map((file) =>
				globalThis.db.orm.public.File.create({
					id: CommonUtils.getRandomId(),
					user: (_user) => _user.connect({ id: user.id }),
					upload: (_upload) => _upload.connect({ id: uploadId }),
					path: file.path,
					mime: file.mime,
					data: new Uint8Array(file.data),
				}),
			),
			...toUpdate.map((file) =>
				globalThis.db.orm.public.File.where({ id: file.id }).update({
					data: new Uint8Array(file.data),
					mime: file.mime,
				}),
			),
			...toDelete.map((id) =>
				globalThis.db.orm.public.File.where({ id }).delete(),
			),
		]);

		await globalThis.db.orm.public.File.where((file) =>
			file.id.in(toUpdate.map((f) => f.id)),
		).updateAndCount({ embedding: null });

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
