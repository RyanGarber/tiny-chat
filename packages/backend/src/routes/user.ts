import { createId } from "@paralleldrive/cuid2";
import { fetchProviders } from "@tiny-chat/shared/src/providers/index.ts";
import type { zUser } from "@tiny-chat/shared/src/types/user.ts";
import { zCache } from "@tiny-chat/shared/src/types/user.ts";
import { z } from "zod";
import { procedure, router } from "../index.ts";
import onTick from "../services/worker.ts";

interface Clone {
	id: string;
	userId: string | null;
}
const clones: Clone[] = [];

async function updateCache(user: zUser) {
	const cache = zCache.parse(
		(
			await globalThis.prisma.user.findUniqueOrThrow({
				where: { id: user.id },
				select: { cache: true },
			})
		).cache,
	);
	cache.providers = await fetchProviders(user);
	await globalThis.prisma.user.update({
		where: { id: user.id },
		data: { cache: cache as any },
	});
	return cache;
}

export default router({
	getCache: procedure.query(async ({ ctx }) => {
		if (!ctx.session.user.settings.useProviderCache) {
			return updateCache(ctx.session.user);
		}
		return zCache.parse(
			(
				await globalThis.prisma.user.findUniqueOrThrow({
					where: { id: ctx.session.user.id },
					select: { cache: true },
				})
			).cache,
		);
	}),

	updateCache: procedure.mutation(async ({ ctx }) => {
		return updateCache(ctx.session.user);
	}),

	startClone: procedure.mutation(({ ctx }) => {
		const id = createId();
		clones.push({ id, userId: null });
		console.log(`Clone ${id} started by ${ctx.session.user.id}`);
		return id;
	}),

	acceptClone: procedure
		.input(z.object({ id: z.cuid2() }))
		.mutation(({ ctx, input }) => {
			const clone = clones.find((c) => c.id === input.id);
			if (!clone) throw new Error("Clone not found");
			clone.userId = ctx.session.user.id;
			console.log(`Clone ${input.id} accepted by ${ctx.session.user.id}`);
		}),

	finalizeClone: procedure
		.input(z.object({ id: z.cuid2() }))
		.query(async ({ ctx, input }) => {
			const clone = clones.find((c) => c.id === input.id);
			if (!clone) throw new Error("Clone not found");
			if (!clone.userId) return false;
			console.log(
				`Clone ${input.id} finalized, ${ctx.session.user.id} is now ${clone.userId}`,
			);
			clones.splice(clones.indexOf(clone), 1);
			await globalThis.prisma.session.update({
				where: { id: ctx.session.session.id },
				data: { user: { connect: { id: clone.userId } } },
			});
			return true;
		}),

	testWorker: procedure.mutation(async ({ ctx }) => {
		if (!process.env.DEV) throw new Error("Test requested while not in dev");
		await onTick(ctx.session.user.id);
	}),
});
