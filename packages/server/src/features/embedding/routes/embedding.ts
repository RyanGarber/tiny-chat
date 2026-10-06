import { z } from "zod";
import { zId } from "#core/core/types/common.ts";
import { MessageLike } from "#core/features/data/types/message.ts";
import { EmbeddingService } from "#server/features/embedding/services/EmbeddingService.ts";
import { procedure, router } from "#server/index.ts";

export const embedding = router({
	getMessageEmbedding: procedure
		.input(MessageLike)
		.query(async ({ ctx, input }) => {
			return await EmbeddingService.getMessageEmbedding({
				user: ctx.session.user,
				message: input,
			});
		}),

	getMissingEmbeddings: procedure
		.input(z.object({ limit: z.number().optional() }))
		.query(async ({ ctx, input }) => {
			return await EmbeddingService.getMissingEmbeddings({
				user: ctx.session.user,
				limit: input.limit,
			});
		}),

	setEmbeddings: procedure
		.input(
			z.array(
				z.object({
					type: z.enum(["message", "memory", "action", "file"]),
					id: zId,
					embedding: z.array(z.number()),
				}),
			),
		)
		.mutation(async ({ ctx, input }) => {
			await EmbeddingService.setEmbeddings({
				user: ctx.session.user,
				embeddings: input,
			});
		}),

	resetAllEmbeddings: procedure.mutation(async ({ ctx }) => {
		await EmbeddingService.resetAllEmbeddings({
			user: ctx.session.user,
		});
	}),
});
