import { Enum } from "@tiny-chat/core/src/core/services/PostgresService.ts";
import { zId } from "@tiny-chat/core/src/core/types/common.ts";
import type { zUploadResult } from "@tiny-chat/core/src/features/file/types/upload.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { GitHubService } from "../services/GitHubService.ts";
import { UploadService } from "../services/UploadService.ts";

export const upload = router({
	getUploads: procedure
		.input(
			z.object({
				kind: z.enum(Enum.UploadKind.values).optional(),
				limit: z.number().optional(),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await UploadService.getUploads({
				user: ctx.session.user,
				kind: input.kind,
				limit: input.limit,
				cursor: input.cursor,
			});
		}),

	getSkills: procedure.query(async ({ ctx }) => {
		return await UploadService.getSkills({ user: ctx.session.user });
	}),

	createUpload: procedure
		.input(
			z
				.instanceof(FormData)
				.transform((fd) => Object.fromEntries(fd.entries()))
				.pipe(
					z.object({
						kind: z.enum(Enum.UploadKind.values),
						file: z.file(),
					}),
				),
		)
		.mutation(async ({ ctx, input }): Promise<zUploadResult> => {
			return await UploadService.createUpload({
				user: ctx.session.user,
				kind: input.kind,
				file: input.file,
			});
		}),

	deleteUpload: procedure
		.input(z.object({ id: zId }))
		.mutation(async ({ ctx, input }) => {
			return await UploadService.deleteUpload({
				user: ctx.session.user,
				id: input.id,
			});
		}),

	getGitHubRepositories: procedure.query(async ({ ctx }) => {
		return await GitHubService.getRepositories({ user: ctx.session.user });
	}),

	cloneGitHubRepository: procedure
		.input(
			z.object({
				owner: z.string().regex(/^[a-zA-Z0-9_-]+$/),
				repository: z.string().regex(/^[a-zA-Z0-9_-]+$/),
				branch: z.string().regex(/^[a-zA-Z0-9_-]+$/),
			}),
		)
		.mutation(async ({ ctx, input }): Promise<zUploadResult> => {
			return await GitHubService.cloneRepository({
				user: ctx.session.user,
				owner: input.owner,
				repository: input.repository,
				branch: input.branch,
			});
		}),
});
