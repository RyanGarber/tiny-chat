import { z } from "zod";
import { zId } from "#core/core/types/common.ts";
import { AuthService } from "#server/core/services/AuthService.ts";
import { AuthServer } from "#server/core/utils/AuthServer.ts";
import { CacheService } from "#server/features/user/services/CacheService.ts";
import { CloneService } from "#server/features/user/services/CloneService.ts";
import { procedure, router } from "#server/index.ts";

export const user = router({
	getAccounts: procedure.query(async ({ ctx }) => {
		return AuthServer.api.listUserAccounts({
			headers: AuthService.headers(ctx.req.headers),
		});
	}),

	getCache: procedure
		.input(
			z.object({
				update: z.boolean().optional(),
				providers: z.array(z.string()).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return CacheService.getCache({
				user: ctx.session.user,
				update: !ctx.session.user.settings.useProviderCache || input.update,
				providers: input.providers,
			});
		}),

	createClone: procedure.mutation(({ ctx }) => {
		return CloneService.createClone({ user: ctx.session.user });
	}),

	continueClone: procedure
		.input(z.object({ id: zId }))
		.mutation(({ ctx, input }) => {
			return CloneService.continueClone({
				user: ctx.session.user,
				id: input.id,
			});
		}),

	completeClone: procedure
		.input(z.object({ id: zId }))
		.mutation(async ({ ctx, input }) => {
			return CloneService.completeClone({
				user: ctx.session.user,
				session: ctx.session.session,
				id: input.id,
			});
		}),
});
