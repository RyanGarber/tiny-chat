import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { SettingsUtils } from "@tiny-chat/core/src/core/utils/SettingsUtils.ts";
import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import { db } from "../../../db.ts";
import { testUser } from "../../../tests.ts";
import { EmbeddingService } from "../../embedding/services/EmbeddingService.ts";
import { MessageService } from "../../message/services/MessageService.ts";
import { ChatService } from "./ChatService.ts";
import {
	DREAM_MEMORY_TOKENS,
	MemoryRetrievalService,
} from "./MemoryRetrievalService.ts";
import { MemorySearchService } from "./MemorySearchService.ts";
import { MemoryService } from "./MemoryService.ts";

const user = testUser();
const other = testUser();
const content = {
	author: "USER" as const,
	config: zConfig.parse({ provider: "test", model: "test-generate" }),
	data: [
		[
			{
				id: CommonUtils.getRandomId(),
				type: "text" as const,
				value: "orchids greenhouse",
			},
		],
	],
	metadata: [],
};
const fact = {
	fact: "The user grows orchids in a greenhouse.",
	category: "PROJECTS" as const,
	stability: "LONG_TERM" as const,
	evidence: ["user statement"],
	confidence: 0.9,
};

const tokens = SettingsUtils.defaults().memoryBudget;

describe("MemoryRetrievalService", () => {
	it("selects memories once at chat creation, isolates users, and supports incognito", async () => {
		const memory = await MemoryService.createMemory({ user, ...fact });
		await MemoryService.createMemory({ user: other, ...fact });
		const message = await MessageService.createMessage({ user, ...content });
		expect(
			(
				await MemoryRetrievalService.retrieve({ user, chat: message, tokens })
			).map((m) => m.id),
		).toEqual([memory.id]);
		const later = await MemoryService.createMemory({
			user,
			...fact,
			fact: "Orchids need the user's automated greenhouse irrigation.",
		});
		const next = await MessageService.createMessage({
			user,
			...content,
			chat: message.chatId,
		});
		expect(
			(await MemoryRetrievalService.retrieve({ user, chat: next, tokens })).map(
				(m) => m.id,
			),
		).toEqual([memory.id]);
		expect(
			await MemoryRetrievalService.retrieve({
				user: other,
				chat: message,
				tokens,
			}),
		).toEqual([]);
		const hidden = await MessageService.createMessage({
			user,
			...content,
			incognito: true,
		});
		expect(
			await MemoryRetrievalService.retrieve({ user, chat: hidden, tokens }),
		).toEqual([]);
		await MemoryService.deleteMemory({ user, id: memory.id });
		expect(
			await MemoryRetrievalService.retrieve({ user, chat: message, tokens }),
		).toEqual([]);
		await MemoryService.updateMemory({
			user,
			id: later.id,
			...fact,
			fact: "The user now studies astronomy.",
		});
		expect(
			(
				await MemorySearchService.searchMemories({
					user,
					searchText: "astronomy",
				})
			).map((m) => m.id),
		).toContain(later.id);
	});

	it("allows deleting a chat and its last message after memories were attached", async () => {
		await MemoryService.createMemory({ user, ...fact });
		const chat = await MessageService.createMessage({ user, ...content });
		await ChatService.deleteChat({ user, chat: chat.chatId });
		expect(
			await db.orm.public.ChatMemory.where({ chatId: chat.chatId }).all(),
		).toEqual([]);
		const message = await MessageService.createMessage({ user, ...content });
		expect(await MessageService.deleteMessage({ user, message })).toBe(true);
		expect(
			await db.orm.public.ChatMemory.where({ chatId: message.chatId }).all(),
		).toEqual([]);
	});

	it("reuses a stored raw vector and does not retrieve unrelated vectors when no query vector exists", async () => {
		const message = await MessageService.createMessage({ user, ...content });
		const vector = [1, 0, 0];
		await db.orm.public.Message.where({ id: message.id }).updateAndCount({
			embedding: vector,
		});
		expect(
			await EmbeddingService.getMessageEmbedding({ user, message }),
		).toEqual(vector);
		expect(
			await MemoryRetrievalService.embed({ user, message, text: "orchids" }),
		).toEqual(vector);
		expect(
			await EmbeddingService.getMessageEmbedding({ user: other, message }),
		).toBeNull();
		const memory = await MemoryService.createMemory({
			user,
			...fact,
			fact: "Sailing is a recurring hobby.",
		});
		await db.orm.public.Memory.where({ id: memory.id }).updateAndCount({
			embedding: vector,
		});
		expect(
			await MemorySearchService.searchMemories({
				user,
				searchText: "unmatchedword",
			}),
		).toEqual([]);
		expect(
			(
				await MemorySearchService.searchMemories({
					user,
					searchText: "unmatchedword",
					searchEmbedding: vector,
				})
			).map((m) => m.id),
		).toContain(memory.id);
	});

	it("bounds a collection larger than the former soft limit and gives dreams more context", () => {
		const memories = Array.from(
			{ length: 300 },
			(_) =>
				({
					fact: "orchids ".repeat(100),
					category: "IDENTITY",
					stability: "LONG_TERM",
					createdAt: Temporal.Now.plainDateTimeISO("UTC"),
				}) satisfies Parameters<
					typeof MemoryRetrievalService.withinBudget
				>[0][number],
		);
		const normal = MemoryRetrievalService.withinBudget(memories, tokens);
		const dream = MemoryRetrievalService.withinBudget(
			memories,
			DREAM_MEMORY_TOKENS,
		);
		expect(dream.length).toBeGreaterThan(normal.length);
		expect(dream.length).toBeLessThan(memories.length);
		expect(
			normal.reduce(
				(n, m) =>
					n +
					m.fact.length +
					m.category.length +
					m.stability.length +
					"1 month ago".length +
					"<memory />".length,
				0,
			),
		).toBeLessThanOrEqual(tokens * 3);
	});
});
