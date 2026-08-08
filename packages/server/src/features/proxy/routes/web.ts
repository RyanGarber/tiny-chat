import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { WebService } from "../services/WebService.ts";

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
