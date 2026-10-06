import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { mockConfig } from "#core/tests.ts";
import { EmbeddingService } from "#server/features/embedding/services/EmbeddingService.ts";
import { MessageService } from "#server/features/message/services/MessageService.ts";
import { testUser } from "#server/tests.ts";

const user = testUser();

describe("EmbeddingService", () => {
	it("finds a missing embedding, hydrates, and returns it", async () => {
		const { id } = await MessageService.createMessage({
			user,
			author: "USER",
			config: mockConfig(),
			data: [
				[
					{
						id: CommonUtils.getRandomId(),
						type: "text",
						value: "Embedding test",
					},
				],
			],
			metadata: [],
		});
		let missing = await EmbeddingService.getMissingEmbeddings({
			user,
			limit: 100,
		});
		expect(missing.messages.find((message) => message.id === id)).toBeDefined();
		console.log(missing);
		await EmbeddingService.setEmbeddings({
			user,
			embeddings: [{ id, type: "message", embedding: [1, 2, 3, 4, 5] }],
		});
		const embedding = await EmbeddingService.getMessageEmbedding({
			user,
			message: { id },
		});
		expect(embedding).toEqual([1, 2, 3, 4, 5]);
		missing = await EmbeddingService.getMissingEmbeddings({ user, limit: 100 });
		expect(
			missing.messages.find((message) => message.id === id),
		).toBeUndefined();
	});
});
