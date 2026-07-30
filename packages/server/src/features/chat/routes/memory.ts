import {
	MemoryCategory,
	MemoryStability,
} from "@tiny-chat/core/src/features/data/types/memory.ts";
import { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { MemorySearchService } from "../services/MemorySearchService.ts";
import { MemoryService } from "../services/MemoryService.ts";

export const memory = router({
	getMemories: procedure.query(async ({ ctx }) => {
		return await MemoryService.getMemories({ user: ctx.session.user });
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
				category: z.enum(MemoryCategory),
				stability: z.enum(MemoryStability),
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
				id: z.cuid2(),
				message: MessageLike.nullish(),
				fact: z.string(),
				category: z.enum(MemoryCategory),
				stability: z.enum(MemoryStability),
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
		.input(z.object({ id: z.cuid2() }))
		.mutation(async ({ ctx, input }) => {
			return await MemoryService.deleteMemory({
				user: ctx.session.user,
				id: input.id,
			});
		}),
});
