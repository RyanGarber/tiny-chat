import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type { UploadKind } from "../../../../generated/prisma/enums.ts";
import type { UploadInclude } from "../../../../generated/prisma/models/Upload.ts";
import { UploadFileService } from "./UploadFileService.ts";

/**
 * Upload management.
 */
export const UploadService = {
	getUploads: async ({
		user,
		kind,
		files,
		limit,
		cursor,
	}: {
		user: zUser;
		kind?: UploadKind;
		files?: UploadInclude["files"];
		limit?: number;
		cursor?: string;
	}) => {
		let uploads = await globalThis.prisma.upload.findMany({
			where: { userId: user.id, kind },
			include: { files },
			orderBy: { createdAt: "desc" },
		});

		if (limit) {
			const index = Math.max(
				0,
				uploads.findIndex((u) => u.id === cursor),
			);
			const nextCursor =
				index + limit < uploads.length ? uploads[index + limit].id : null;
			uploads = uploads.slice(index, index + limit);
			return { uploads, nextCursor };
		}

		return { uploads, nextCursor: null };
	},

	createUpload: async ({
		user,
		kind,
		file,
	}: {
		user: zUser;
		kind: UploadKind;
		file: File;
	}) => {
		return file.name.endsWith(".zip")
			? await UploadFileService.uploadZip({
					user,
					zip: await file.arrayBuffer(),
					kind,
				})
			: await UploadFileService.upload({
					user,
					files: [[file.name, await file.arrayBuffer()]],
					kind,
				});
	},

	deleteUpload: async ({ user, id }: { user: zUser; id: string }) => {
		await globalThis.prisma.upload.delete({
			where: { id, userId: user.id },
		});
	},
} as const;
