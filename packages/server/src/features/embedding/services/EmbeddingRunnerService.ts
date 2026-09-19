import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { EmbeddingUtils } from "@tiny-chat/core/src/features/provider/utils/EmbeddingUtils.ts";
import { EmbeddingService } from "./EmbeddingService.ts";

let running = false;

/**
 * Background embedding hydration for providers that can run on the server
 * (everything in ModelProviderService — not client-only WebLLM/AFM).
 *
 * Mirrors the client useEmbedding loop: fetch a small missing batch, embed via
 * the shared helper, persist, then yield until the next worker tick.
 */
export const EmbeddingRunnerService = {
	next: async ({ testUserId }: { testUserId?: string } = {}) => {
		if (running) {
			console.warn(
				"[EmbeddingRunnerService] ignoring run because one is already running",
			);
			return;
		}

		running = true;

		try {
			const users = await globalThis.db.orm.public.User.where(
				testUserId ? { id: testUserId } : { isEphemeral: false },
			)
				.select("id", "name", "settings", "isEphemeral")
				.all();

			for (const row of users) {
				const user = row as zUser;
				const config = user.settings.embeddingConfig;
				if (!config) continue;

				const provider = EmbeddingUtils.getServerProvider(config.provider);
				if (!provider) continue;

				try {
					const batch = await EmbeddingService.getMissingEmbeddings({
						user,
						limit: EmbeddingUtils.BATCH_LIMIT,
					});
					const count = EmbeddingUtils.count(batch);
					if (count === 0) continue;

					console.log(
						`[EmbeddingRunnerService] embedding ${count} item(s) for user ${user.id} via ${config.provider}/${config.model}`,
					);

					const embeddings = await EmbeddingUtils.runBatch({
						user,
						provider,
						config,
						env: {},
						batch,
					});

					await EmbeddingService.setEmbeddings({ user, embeddings });
				} catch (error) {
					console.error(
						`[EmbeddingRunnerService] error embedding for user ${user.id}:`,
						error,
					);
				}
			}
		} finally {
			running = false;
		}
	},
} as const;
