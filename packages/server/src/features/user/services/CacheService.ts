import type {
	zCache,
	zUser,
} from "@tiny-chat/core/src/features/data/types/user.ts";
import { ProviderService } from "@tiny-chat/core/src/features/provider/services/ProviderService.ts";

/**
 * Cache management for heavy operations like model discovery.
 */
export const CacheService = {
	getCache: async ({ user, update }: { user: zUser; update?: boolean }) => {
		const existing = await globalThis.db.orm.public.User.where({
			id: user.id,
		})
			.select("cache")
			.first();
		if (!existing) throw new Error("missing user");

		return update ? await CacheService.updateCache({ user }) : existing.cache;
	},

	setCache: async ({
		user,
		values,
	}: {
		user: zUser;
		values: Partial<zCache>;
	}) => {
		const existing = await CacheService.getCache({ user });
		const updatedCache: zCache = { ...existing, ...values };
		await globalThis.db.orm.public.User.where({ id: user.id }).update({
			cache: updatedCache as any,
		});
	},

	updateCache: async ({ user }: { user: zUser }): Promise<zCache> => {
		const cache: zCache = (
			await globalThis.db.orm.public.User.where({ id: user.id })
				.select("cache")
				.first()
		)?.cache ?? { providers: [] };

		cache.providers = JSON.parse(
			JSON.stringify(await ProviderService.getProviderStates({ user })),
		);

		await globalThis.db.orm.public.User.where({ id: user.id }).update({
			cache: cache as any,
		});

		return cache;
	},
} as const;
