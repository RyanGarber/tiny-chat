import type { Enum } from "@tiny-chat/core/src/core/services/PostgresService.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type { FileState } from "@tiny-chat/core/src/features/file/types/file.ts";
import type { UploadState } from "@tiny-chat/core/src/features/file/types/upload.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { UploadFileService } from "./UploadFileService.ts";

/**
 * Upload management.
 */
export const UploadService = {
	getUploads: async ({
		user,
		kind,
		limit,
		cursor,
	}: {
		user: zUser;
		kind?: Enum["UploadKind"];
		limit?: number;
		cursor?: string;
	}) => {
		let _uploads = globalThis.db.orm.public.Upload.where({
			userId: user.id,
		}).orderBy((upload) => upload.createdAt.desc());
		if (kind) _uploads = _uploads.where({ kind });
		let uploads = await _uploads.all();

		if (limit) {
			const index = Math.max(
				0,
				uploads.findIndex((upload) => upload.id === cursor),
			);
			const nextCursor =
				index + limit < uploads.length ? uploads[index + limit].id : null;
			uploads = uploads.slice(index, index + limit);
			return { uploads, nextCursor };
		}

		return { uploads, nextCursor: null };
	},

	getSkills: async ({ user }: { user: zUser }) => {
		const uploads = await globalThis.db.orm.public.Upload.where({
			userId: user.id,
			kind: "SKILL",
		}).all();
		const skills: (UploadState & { files: FileState[] })[] = [];
		for (const upload of uploads) {
			skills.push({
				...upload,
				files: FileUtils.toFileStates(
					await globalThis.db.runtime().query(
						globalThis.db.sql.public.file
							.select(
								"id",
								"userId",
								"uploadId",
								"chatId",
								"path",
								"mime",
								"data",
								"createdAt",
								"updatedAt",
							)
							.where((f, fns) =>
								fns.raw`'SKILL.md' = ANY(ARRAY[${f.path}])`.returns(
									"pg/bool@1",
								),
							)
							.build(),
					),
					"skills",
				),
			});
		}
		return skills;
	},

	createUpload: async ({
		user,
		kind,
		file,
	}: {
		user: zUser;
		kind: Enum["UploadKind"];
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
		await globalThis.db.orm.public.Upload.where({
			userId: user.id,
			id,
		}).delete();
	},
} as const;
