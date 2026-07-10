import { createId } from "@paralleldrive/cuid2";
import type { zUser } from "@tiny-chat/shared/src/types/user.ts";
import { mimeType } from "@tiny-chat/shared/src/utils/files.ts";
import { unzipSync } from "fflate";
import { MarkItDown } from "markitdown-ts";
import sharp from "sharp";
import { type File, Prisma } from "../../generated/prisma/client.ts";
import { shouldIncludeFile } from "../utils/files.ts";

export async function handleFilesZipped(
	user: zUser,
	zip: ArrayBuffer,
	existingFiles: File[] = [],
	uploadId: string,
	include?: (path: string) => boolean,
	skipRoot?: boolean,
) {
	const unzipped = unzipSync(new Uint8Array(zip));
	console.log(`Unzipped zip with ${Object.keys(unzipped).length} files`);

	const files = Object.entries(unzipped).filter(([path]) =>
		shouldIncludeFile(path, false),
	);

	return await handleFiles(
		user,
		files.map(([name, data]) => [
			name
				.split("/")
				.slice(skipRoot ? 1 : 0)
				.join("/"),
			data.buffer,
		]),
		existingFiles,
		uploadId,
		include,
	);
}

export async function handleFiles(
	user: zUser,
	files: [string, ArrayBufferLike][],
	existingFiles: File[] = [],
	uploadId: string,
	include?: (path: string) => boolean,
) {
	const toCreate: { path: string[]; mime: string; data: Uint8Array }[] = [];
	const toUpdate: { id: string; data: Uint8Array; mime: string }[] = [];
	const paths = new Set<string>();
	const preprocessing = new Map<
		string,
		{ text?: string; thumbnail?: string }
	>();

	const existingFilesMap = new Map(
		existingFiles.map((f) => [f.path.join("/"), f]),
	);

	for (const [rawPath, content] of files) {
		if (include && !include(rawPath)) {
			console.log(
				`Skipping file ${rawPath} because it does not match the include criteria`,
			);
			continue;
		}

		if (rawPath.endsWith("/")) {
			console.log(`Skipping file ${rawPath} because it is a directory`);
			continue;
		}

		console.log(`Processing file ${rawPath}`);

		const pathParts = rawPath.split("/");
		const pathKey = pathParts.join("/");

		paths.add(pathKey);

		const existingFile = existingFilesMap.get(pathKey);

		const preprocessed = await preprocessFile(
			Buffer.from(content),
			pathParts[pathParts.length - 1],
			undefined,
		);
		if (!preprocessed) throw new Error(`Failed to preprocess file ${rawPath}`);
		const { data, mime, text, thumbnail } = preprocessed;
		console.log(
			`Preprocessed file ${rawPath} with ${data.length} bytes of ${mime}`,
			text,
		);

		if (!existingFile) {
			toCreate.push({ path: pathParts, mime, data });
		} else {
			// Compare binary data
			const isChanged =
				Buffer.compare(Buffer.from(existingFile.data), Buffer.from(content)) !==
				0;
			if (isChanged) {
				toUpdate.push({ id: existingFile.id, data, mime });
			}
		}

		preprocessing.set(pathKey, { text, thumbnail });
	}

	const toDelete = existingFiles
		.filter((f) => !paths.has(f.path.join("/")))
		.map((f) => f.id);

	console.log(
		`Incremental sync: ${toCreate.length} to create, ${toUpdate.length} to update, ${toDelete.length} to delete`,
	);

	// TODO - no transaction due to timeouts
	const result = await Promise.all([
		...toCreate.map((f) =>
			globalThis.prisma.file.create({
				data: {
					id: createId(),
					user: { connect: { id: user.id } },
					upload: { connect: { id: uploadId } },
					path: f.path,
					mime: f.mime,
					data: new Uint8Array(f.data),
				},
			}),
		),
		...toUpdate.map((f) =>
			globalThis.prisma.file.update({
				where: { id: f.id },
				data: {
					data: new Uint8Array(f.data),
					mime: f.mime,
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
			.$executeRaw`UPDATE file SET embedding = NULL WHERE id IN (${Prisma.join(toUpdate.map((u) => u.id))})`;
	}

	return result.map((f) => ({ ...f, ...preprocessing.get(f.path.join("/")) }));
}

export async function preprocessFile(
	data: Buffer,
	filename?: string,
	fallbackMime?: string,
) {
	let text: string | undefined;
	let thumbnail: string | undefined;
	let mime =
		(await mimeType(data, filename, fallbackMime)) ??
		"application/octet-stream";

	console.log(`Preprocessing file ${filename} with mime ${mime}`);
	if (
		mime.includes("image/") &&
		["png", "jpg", "jpeg", "gif", "webp", "avif", "tiff", "svg"].some((type) =>
			mime.includes(type),
		)
	) {
		try {
			mime = "image/webp";
			data = await sharp(data, { failOn: "none", animated: true })
				.resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
				.webp({ quality: 80 })
				.toBuffer();
			thumbnail = `data:${mime};base64,${await sharp(data, { failOn: "none" })
				.resize(512, 512, { fit: "inside", withoutEnlargement: true })
				.webp({ quality: 80 })
				.toBuffer()
				.then((buf) => buf.toString("base64"))}`;
			console.log(
				`Optimized image size: ${data.length} bytes; thumbnail size: ${thumbnail.length} characters`,
			);
		} catch (e) {
			console.error(e);
			throw e;
		}
	} else if (
		(mime.includes("officedocument") ||
			mime.includes("msword") ||
			mime.includes("ms-excel") ||
			mime.includes("ms-powerpoint")) &&
		filename
	) {
		// TODO - replace this entirely
		try {
			const parsed = await new MarkItDown().convertBuffer(data, {
				file_extension: filename.slice(filename.lastIndexOf(".")),
			});
			if (!parsed) return;
			data = Buffer.from(parsed.markdown);
			text = parsed.markdown;
			mime = "text/plain";
			console.log(`Extracted text:`, text);
		} catch (e) {
			console.error(e);
			throw e;
		}
	}

	return { data, mime: mime, text, thumbnail };
}
