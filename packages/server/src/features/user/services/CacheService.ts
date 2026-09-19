import type {
	zCache,
	zUser,
} from "@tiny-chat/core/src/features/data/types/user.ts";
import { ProviderService } from "@tiny-chat/core/src/features/provider/services/ProviderService.ts";

/**
 * Cache management for heavy operations like model discovery.
 */
export const CacheService = {
	getCache: async ({
		user,
		update,
		providers,
	}: {
		user: zUser;
		update?: boolean;
		providers?: string[];
	}) => {
		const existing = await globalThis.db.orm.public.User.where({
			id: user.id,
		})
			.select("cache")
			.first();
		if (!existing) throw new Error("missing user");

		return update
			? await CacheService.updateCache({ user, providers })
			: existing.cache;
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

	/**
	 * Recheck provider states, or only the named ones, keeping the rest cached.
	 */
	updateCache: async ({
		user,
		providers,
	}: {
		user: zUser;
		providers?: string[];
	}): Promise<zCache> => {
		const cache: zCache = (
			await globalThis.db.orm.public.User.where({ id: user.id })
				.select("cache")
				.first()
		)?.cache ?? { providers: [] };

		const updated: zCache["providers"] = JSON.parse(
			JSON.stringify(
				await ProviderService.getProviderStates({ user, names: providers }),
			),
		);

		cache.providers = providers
			? [
					...cache.providers.map(
						(provider) =>
							updated.find((state) => state.name === provider.name) ?? provider,
					),
					...updated.filter(
						(state) =>
							!cache.providers.some((provider) => provider.name === state.name),
					),
				]
			: updated;

		await globalThis.db.orm.public.User.where({ id: user.id }).update({
			cache: cache as any,
		});

		return cache;
	},
} as const;
