import { z } from "zod";
import { Enum } from "#core/core/services/PostgresService.ts";
import { zId } from "#core/core/types/common.ts";
import { ChatLike } from "#core/features/data/types/chat.ts";
import { MemorySource } from "#core/features/data/types/memory.ts";
import { MessageLike } from "#core/features/data/types/message.ts";
import { MemoryRetrievalService } from "#server/features/chat/services/MemoryRetrievalService.ts";
import { MemorySearchService } from "#server/features/chat/services/MemorySearchService.ts";
import { MemoryService } from "#server/features/chat/services/MemoryService.ts";
import { procedure, router } from "#server/index.ts";

export const memory = router({
	retrieveMemories: procedure
		.input(
			z.object({
				messages: z.array(MemorySource),
				tokens: z.number(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await MemoryRetrievalService.retrieve({
				user: ctx.session.user,
				messages: input.messages,
				tokens: input.tokens,
			});
		}),

	getMemories: procedure.query(async ({ ctx }) => {
		return await MemoryService.getMemories({ user: ctx.session.user });
	}),

	getChatMemoryIds: procedure
		.input(z.object({ chat: ChatLike }))
		.query(async ({ ctx, input }) => {
			return await MemoryService.getChatMemoryIds({
				user: ctx.session.user,
				chat: input.chat,
			});
		}),

	searchMemories: procedure
		.input(
			z.object({
				searchText: z.string(),
				searchEmbedding: z.array(z.number()).optional(),
				limit: z.number().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await MemorySearchService.searchMemories({
				user: ctx.session.user,
				searchText: input.searchText,
				searchEmbedding: input.searchEmbedding,
				limit: input.limit,
			});
		}),

	createMemory: procedure
		.input(
			z.object({
				message: MessageLike.nullish(),
				fact: z.string(),
				category: z.enum(Enum.MemoryCategory.values),
				stability: z.enum(Enum.MemoryStability.values),
				evidence: z.array(z.string()),
				confidence: z.number(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await MemoryService.createMemory({
				user: ctx.session.user,
				message: input.message,
				fact: input.fact,
				category: input.category,
				stability: input.stability,
				evidence: input.evidence,
				confidence: input.confidence,
			});
		}),

	updateMemory: procedure
		.input(
			z.object({
				id: zId,
				message: MessageLike.nullish(),
				fact: z.string(),
				category: z.enum(Enum.MemoryCategory.values),
				stability: z.enum(Enum.MemoryStability.values),
				evidence: z.array(z.string()),
				confidence: z.number(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await MemoryService.updateMemory({
				id: input.id,
				user: ctx.session.user,
				message: input.message,
				fact: input.fact,
				category: input.category,
				stability: input.stability,
				evidence: input.evidence,
				confidence: input.confidence,
			});
		}),

	deleteMemory: procedure
		.input(z.object({ id: zId }))
		.mutation(async ({ ctx, input }) => {
			return await MemoryService.deleteMemory({
				user: ctx.session.user,
				id: input.id,
			});
		}),
});
