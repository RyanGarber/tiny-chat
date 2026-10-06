import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { DataUtils } from "#core/features/data/utils/DataUtils.ts";
import { mockConfig } from "#core/tests.ts";
import { ChatSearchService } from "#server/features/chat/services/ChatSearchService.ts";
import { EmbeddingService } from "#server/features/embedding/services/EmbeddingService.ts";
import { MessageService } from "#server/features/message/services/MessageService.ts";
import { testUser } from "#server/tests.ts";

const user = testUser();

describe("ChatSearchService", () => {
	it("searches using paradedb indexes", async () => {
		const message = await MessageService.createMessage({
			user,
			author: "USER",
			config: mockConfig(),
			data: [
				[{ id: CommonUtils.getRandomId(), type: "text", value: "RARETERM" }],
			],
			metadata: [],
		});
		await EmbeddingService.setEmbeddings({
			user,
			embeddings: [{ type: "message", id: message.id, embedding: [1, 2, 3] }],
		});
		const { results } = await ChatSearchService.searchChats({
			user,
			searchText: "RARETERM",
			searchEmbedding: [1, 2, 2],
		});

		expect(
			results.find((result) => DataUtils.getText(result).includes("RARETERM")),
		).toBeDefined();
	});
	it("supports lexical typos, diverse chats, pagination, and mismatched dimensions", async () => {
		const create = (chat?: string) =>
			MessageService.createMessage({
				user,
				chat,
				author: "USER",
				config: mockConfig(),
				data: [
					[
						{
							id: CommonUtils.getRandomId(),
							type: "text",
							value: "chrysanthemum cultivation",
						},
					],
				],
				metadata: [],
			});
		const first = await create();
		await create(first.chatId);
		const second = await create();
		await EmbeddingService.setEmbeddings({
			user,
			embeddings: [{ type: "message", id: first.id, embedding: [1, 0, 0] }],
		});
		const args = { user, searchText: "chrysanthemun", limit: 2 };
		const page = await ChatSearchService.searchChats(args);
		const repeated = await ChatSearchService.searchChats({
			...args,
			searchText: "Chrysanthemun ".repeat(3000),
		});
		expect(repeated).toEqual(page);
		expect(new Set(page.results.map((row) => row.chatId))).toEqual(
			new Set([first.chatId, second.chatId]),
		);
		expect(page.nextCursor).not.toBeNull();
		const next = await ChatSearchService.searchChats({
			...args,
			cursor: page.nextCursor ?? undefined,
		});
		expect(next.results).toHaveLength(1);
		expect(page.results.map((row) => row.id)).not.toContain(next.results[0].id);
		expect(next.nextCursor).toBeNull();
		expect(
			(
				await ChatSearchService.searchChats({
					...args,
					searchEmbedding: [1, 0],
				})
			).results,
		).toHaveLength(2);
		expect(
			(
				await ChatSearchService.searchChats({
					user,
					searchText: "unrelatedtoken",
					searchEmbedding: [1, 0, 0],
				})
			).results.map((row) => row.id),
		).toContain(first.id);
		expect(
			(await ChatSearchService.searchChats({ user, searchText: "  " })).results,
		).toEqual([]);
	});
});
