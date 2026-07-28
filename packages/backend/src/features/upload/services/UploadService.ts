import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import type { UploadType } from "../../../../generated/prisma/enums.ts";
import type {
	UploadInclude,
	UploadWhereInput,
} from "../../../../generated/prisma/models/Upload.ts";
import { FileService } from "./FileService.ts";

/**
 * Upload management.
 */
export const UploadService = {
	getUploads: async ({
		user,
		where,
		files,
		limit,
		cursor,
	}: {
		user: zUser;
		where?: UploadWhereInput;
		files?: UploadInclude["files"];
		limit?: number;
		cursor?: string;
	}) => {
		let uploads = await globalThis.prisma.upload.findMany({
			where: { userId: user.id, ...where },
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
		type,
		file,
	}: {
		user: zUser;
		type: UploadType;
		file: File;
	}) => {
		return file.name.endsWith(".zip")
			? await FileService.uploadZip({
					user,
					create: {
						type,
					},
					zip: await file.arrayBuffer(),
				})
			: await FileService.upload({
					user,
					create: {
						type,
					},
					files: [[file.name, await file.arrayBuffer()]],
				});
	},

	deleteUpload: async ({ user, id }: { user: zUser; id: string }) => {
		await globalThis.prisma.upload.delete({
			where: { id, userId: user.id },
		});
	},
} as const;
