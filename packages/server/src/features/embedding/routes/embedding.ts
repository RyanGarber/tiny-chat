import { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { EmbeddingService } from "../services/EmbeddingService.ts";

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
					id: z.cuid2(),
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
