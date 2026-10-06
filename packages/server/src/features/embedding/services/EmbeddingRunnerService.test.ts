import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { mockConfig } from "#core/tests.ts";
import { db } from "#server/db.ts";
import { EmbeddingRunnerService } from "#server/features/embedding/services/EmbeddingRunnerService.ts";
import { EmbeddingService } from "#server/features/embedding/services/EmbeddingService.ts";
import { MessageService } from "#server/features/message/services/MessageService.ts";
import { testUser } from "#server/tests.ts";

const user = testUser();

describe("EmbeddingRunnerService", () => {
	it("hydrates missing embeddings for a server-capable provider", async () => {
		// Create without an embedding config so MessageService does not embed on write.
		const { id } = await MessageService.createMessage({
			user,
			author: "USER",
			config: mockConfig(),
			data: [
				[
					{
						id: CommonUtils.getRandomId(),
						type: "text",
						value: "Background embedding hydration",
					},
				],
			],
			metadata: [],
		});

		expect(
			(
				await EmbeddingService.getMissingEmbeddings({ user, limit: 100 })
			).messages.find((message) => message.id === id),
		).toBeDefined();

		const embeddingConfig = mockConfig(undefined, "test-embed");
		await db.orm.public.User.where({ id: user.id }).update({
			settings: { embeddingConfig },
		});

		await EmbeddingRunnerService.next({ testUserId: user.id });

		const embedding = await EmbeddingService.getMessageEmbedding({
			user,
			message: { id },
		});
		expect(embedding).toEqual(
			Array.from(
				{ length: 8 },
				(_, i) => ("Background embedding hydration".length + i) / 100,
			),
		);
		expect(
			(
				await EmbeddingService.getMissingEmbeddings({ user, limit: 100 })
			).messages.find((message) => message.id === id),
		).toBeUndefined();
	});

	it("skips client-only providers", async () => {
		const { id } = await MessageService.createMessage({
			user,
			author: "USER",
			config: mockConfig(),
			data: [
				[
					{
						id: CommonUtils.getRandomId(),
						type: "text",
						value: "Client-only provider should not embed on the server",
					},
				],
			],
			metadata: [],
		});

		await db.orm.public.User.where({ id: user.id }).update({
			settings: {
				embeddingConfig: {
					...mockConfig(undefined, "test-embed"),
					provider: "native",
				},
			},
		});

		await EmbeddingRunnerService.next({ testUserId: user.id });

		expect(
			await EmbeddingService.getMessageEmbedding({ user, message: { id } }),
		).toBeNull();
	});
});
