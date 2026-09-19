import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { GitHubApiService } from "../services/GitHubApiService.ts";

export const github = router({
	request: procedure
		.input(
			z.object({
				path: z.string(),
				query: z
					.record(
						z.string(),
						z.union([z.string(), z.number(), z.boolean(), z.undefined()]),
					)
					.optional(),
				preferLinkedAccount: z.boolean(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await GitHubApiService.request({
				user: ctx.session.user,
				...input,
			});
		}),
});
