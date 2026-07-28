import {
	zCache,
	type zUser,
} from "@tiny-chat/shared/src/features/data/types/user.ts";
import { ProviderService } from "@tiny-chat/shared/src/features/provider/services/ProviderService.ts";

/**
 * Cache management for heavy operations like model discovery.
 */
export const CacheService = {
	getCache: async ({ user, update }: { user: zUser; update?: boolean }) => {
		const existing = await globalThis.prisma.user.findUnique({
			where: { id: user.id },
			select: { cache: true },
		});

		if (!existing?.cache || update) {
			return CacheService.updateCache({ user });
		}

		return zCache.parse(
			(
				await globalThis.prisma.user.findUniqueOrThrow({
					where: { id: user.id },
					select: { cache: true },
				})
			).cache,
		);
	},

	updateCache: async ({ user }: { user: zUser }) => {
		const cache = zCache.parse(
			(
				await globalThis.prisma.user.findUniqueOrThrow({
					where: { id: user.id },
					select: { cache: true },
				})
			).cache,
		);

		cache.providers = JSON.parse(
			JSON.stringify(await ProviderService.getProviderStates({ user })),
		);

		await globalThis.prisma.user.update({
			where: { id: user.id },
			data: { cache: cache as any },
		});

		return cache;
	},
} as const;
