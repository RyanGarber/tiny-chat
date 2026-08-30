import { or } from "@prisma/orm-postgres/orm-client";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MemorySearchResult } from "@tiny-chat/core/src/features/data/types/memory.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { createEmbeddingCapability } from "../../../core/capabilities/createEmbeddingCapability.ts";
import { EmbeddingService } from "../../embedding/services/EmbeddingService.ts";
import { MemoryBudgetUtils } from "../utils/MemoryBudgetUtils.ts";
import { MemoryUtils } from "../utils/MemoryUtils.ts";
import { MemorySearchService } from "./MemorySearchService.ts";

export const CHAT_MEMORY_TOKENS = 2_500;
export const DREAM_MEMORY_TOKENS = 12_000;

export const MemoryRetrievalService = {
	withinBudget: MemoryBudgetUtils.withinBudget,

	embed: async ({
		user,
		text,
		message,
	}: {
		user: zUser;
		text: string;
		message?: MessageLike;
	}) => {
		const stored = await EmbeddingService.getMessageEmbedding({
			user,
			message,
		});
		if (stored) return stored;
		if (!text.trim() || !user.settings.embeddingConfig) return undefined;
		try {
			const capability = await createEmbeddingCapability({ user });
			const embedding = await capability.runEmbedding({ text });
			if (message) {
				const id = typeof message === "string" ? message : message.id;
				await globalThis.db.runtime().execute(
					globalThis.db.raw.sql`
					UPDATE message SET embedding = ${JSON.stringify(embedding)}::vector
					WHERE id = ${id} AND "userId" = ${user.id} AND embedding IS NULL
				`
						.affectedCount()
						.build(),
				);
			}
			return embedding;
		} catch (error) {
			console.warn(
				"[MemoryRetrievalService] embedding unavailable; using lexical retrieval",
				error,
			);
			return undefined;
		}
	},

	build: async ({
		user,
		text,
		message,
		tokens = CHAT_MEMORY_TOKENS,
	}: {
		user: zUser;
		text: string;
		message?: MessageLike;
		tokens?: number;
	}): Promise<{ memories: MemorySearchResult[]; embedding?: number[] }> => {
		if (!text.trim()) return { memories: [] };
		const embedding = await MemoryRetrievalService.embed({
			user,
			text,
			message,
		});
		const memories = await MemorySearchService.searchMemories({
			user,
			searchText: text,
			searchEmbedding: embedding,
			limit: tokens === CHAT_MEMORY_TOKENS ? 100 : 300,
			minConfidence: tokens === CHAT_MEMORY_TOKENS ? 0.5 : 0,
			tokens,
		});
		return {
			memories: MemoryRetrievalService.withinBudget(memories, tokens),
			embedding,
		};
	},

	retrieve: async ({
		user,
		chat: chatId,
	}: {
		user: zUser;
		chat?: ChatLike | MessageLike | null;
	}) => {
		if (typeof chatId === "object") chatId = chatId?.id;
		if (!chatId) {
			const memories = await globalThis.db.orm.public.Memory.where({
				userId: user.id,
			})
				.orderBy([(memory) => memory.fact.asc()])
				.all();

			return MemoryRetrievalService.withinBudget(memories, CHAT_MEMORY_TOKENS);
		}

		const chat = await globalThis.db.orm.public.Chat.where({
			userId: user.id,
			incognito: false,
		})
			.where((chat) =>
				or(
					chat.id.eq(chatId),
					chat.messages.some((message) => message.id.eq(chatId)),
				),
			)
			.include("memories", (memory) =>
				memory.select(
					"userId",
					"id",
					"fact",
					"category",
					"config",
					"messageId",
					"stability",
					"evidence",
					"confidence",
					"createdAt",
				),
			)
			.first();

		if (!chat) return [];

		return MemoryRetrievalService.withinBudget(
			chat.memories.map(MemoryUtils.toMemoryState),
			CHAT_MEMORY_TOKENS,
		);
	},
} as const;
