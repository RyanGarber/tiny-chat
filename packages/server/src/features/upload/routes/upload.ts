import type { zDataPart } from "@tiny-chat/core/src/features/data/types/message.ts";
import { z } from "zod";
import { UploadType } from "../../../../generated/prisma/enums.ts";
import type {
	UploadInclude,
	UploadWhereInput,
} from "../../../../generated/prisma/models/Upload.ts";
import { procedure, router } from "../../../index.ts";
import { GitHubService } from "../services/GitHubService.ts";
import { UploadService } from "../services/UploadService.ts";

export const upload = router({
	getUploads: procedure
		.input(
			z.object({
				where: z.custom<UploadWhereInput>().optional(),
				files: z.custom<UploadInclude["files"]>().optional(),
				limit: z.number().optional(),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await UploadService.getUploads({
				user: ctx.session.user,
				where: input.where,
				files: input.files,
				limit: input.limit,
				cursor: input.cursor,
			});
		}),

	createUpload: procedure
		.input(
			z
				.instanceof(FormData)
				.transform((fd) => Object.fromEntries(fd.entries()))
				.pipe(
					z.object({
						type: z.enum(UploadType),
						file: z.file(),
					}),
				),
		)
		.mutation(
			async ({
				ctx,
				input,
			}): Promise<Extract<zDataPart, { type: "upload" }>> => {
				const upload = await UploadService.createUpload({
					user: ctx.session.user,
					type: input.type,
					file: input.file,
				});

				return {
					type: "upload",
					id: upload.id,
					name: upload.name,
					thumbnail: upload.thumbnail ?? undefined,
				};
			},
		),

	deleteUpload: procedure
		.input(z.object({ id: z.cuid2() }))
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
		.mutation(
			async ({
				ctx,
				input,
			}): Promise<Extract<zDataPart, { type: "upload" }>> => {
				const upload = await GitHubService.cloneRepository({
					user: ctx.session.user,
					owner: input.owner,
					repository: input.repository,
					branch: input.branch,
				});
				return {
					type: "upload",
					id: upload.id,
					name: upload.name,
					thumbnail: upload.thumbnail ?? undefined,
				};
			},
		),
});
