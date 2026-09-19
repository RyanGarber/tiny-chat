import { or } from "@prisma/orm-postgres/orm-client";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type {
	MemorySearchResult,
	MemoryState,
} from "@tiny-chat/core/src/features/data/types/memory.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { createEmbeddingCapability } from "../../../core/capabilities/createEmbeddingCapability.ts";
import { EmbeddingService } from "../../embedding/services/EmbeddingService.ts";
import { MemoryUtils } from "../utils/MemoryUtils.ts";
import { MemorySearchService } from "./MemorySearchService.ts";

const MEMORY_BOILERPLATE = `<memory id="" category="" stability="" learned="">\n\n</memory>`;

export const MemoryRetrievalService = {
	withinBudget: <
		T extends Pick<
			MemoryState,
			"fact" | "category" | "stability" | "createdAt"
		>,
	>(
		memories: T[],
		tokens: number,
	): T[] => {
		let remaining = tokens * 3;
		return memories.filter((memory) => {
			const size =
				MEMORY_BOILERPLATE.length +
				memory.fact.length +
				memory.category.length +
				memory.stability.length +
				CommonUtils.formatDate({ date: memory.createdAt, relative: true })
					.length;
			if (size > remaining) return false;
			remaining -= size;
			return true;
		});
	},

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
				await globalThis.db.orm.public.Message.where({
					id,
					userId: user.id,
				})
					.where((message) => message.embedding.isNull())
					.updateAndCount({ embedding });
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
		tokens,
		more,
	}: {
		user: zUser;
		text: string;
		message?: MessageLike;
		tokens: number;
		more: boolean;
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
			limit: more ? 300 : 100,
			minConfidence: more ? 0 : 0.5,
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
		tokens,
	}: {
		user: zUser;
		chat?: ChatLike | MessageLike | null;
		tokens: number;
	}): Promise<MemoryState[]> => {
		if (typeof chatId === "object") chatId = chatId?.id;

		if (!chatId) {
			const memories = await globalThis.db.orm.public.Memory.select(
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
				"updatedAt",
			)
				.where({
					userId: user.id,
				})
				.where((memory) => memory.confidence.gt(0.5))
				.orderBy([(memory) => memory.createdAt.desc()])
				.limit(50)
				.all();

			return MemoryRetrievalService.withinBudget(memories, tokens);
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
					"updatedAt",
				),
			)
			.first();

		if (!chat) return [];

		return MemoryRetrievalService.withinBudget(
			chat.memories.map(MemoryUtils.toMemoryState),
			tokens,
		);
	},
} as const;
