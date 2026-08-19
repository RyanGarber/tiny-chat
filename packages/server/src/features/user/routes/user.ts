import { z } from "zod";
import { AuthService } from "../../../core/services/AuthService.ts";
import { AuthServer } from "../../../core/utils/AuthServer.ts";
import { procedure, router } from "../../../index.ts";
import { CacheService } from "../services/CacheService.ts";
import { CloneService } from "../services/CloneService.ts";

export const user = router({
	getAccounts: procedure.query(async ({ ctx }) => {
		return AuthServer.api.listUserAccounts({
			headers: AuthService.headers(ctx.req.headers),
		});
	}),

	getCache: procedure
		.input(z.object({ update: z.boolean().optional() }))
		.query(async ({ ctx, input }) => {
			return CacheService.getCache({
				user: ctx.session.user,
				update: !ctx.session.user.settings.useProviderCache || input.update,
			});
		}),

	createClone: procedure.mutation(({ ctx }) => {
		return CloneService.createClone({ user: ctx.session.user });
	}),

	continueClone: procedure
		.input(z.object({ id: z.cuid2() }))
		.mutation(({ ctx, input }) => {
			return CloneService.continueClone({
				user: ctx.session.user,
				id: input.id,
			});
		}),

	completeClone: procedure
		.input(z.object({ id: z.cuid2() }))
		.mutation(async ({ ctx, input }) => {
			return CloneService.completeClone({
				user: ctx.session.user,
				session: ctx.session.session,
				id: input.id,
			});
		}),
});
