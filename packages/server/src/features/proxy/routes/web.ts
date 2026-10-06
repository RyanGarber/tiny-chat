import { z } from "zod";
import { WebService } from "#server/features/proxy/services/WebService.ts";
import { procedure, router } from "#server/index.ts";

export const web = router({
	search: procedure
		.input(z.object({ query: z.string(), maxResults: z.number() }))
		.query(async ({ ctx, input }) => {
			return await WebService.search({
				user: ctx.session.user,
				query: input.query,
				maxResults: input.maxResults,
			});
		}),

	view: procedure
		.input(z.object({ url: z.string() }))
		.query(async ({ ctx, input }) => {
			return await WebService.view({ user: ctx.session.user, url: input.url });
		}),
});
