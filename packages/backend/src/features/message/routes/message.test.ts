import { describe, expect, inject, it } from "vitest";
import { testTRPC } from "../../../tests.ts";

describe("routes - message", () => {
	const trpc = testTRPC();

	it("creates a new chat with two messages", async () => {
		const first = await trpc.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "First message" }]],
			metadata: [],
		});

		const second = await trpc.message.createMessage.mutate({
			chat: first.chatId,
			author: "MODEL",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Reply from model" }]],
			metadata: [],
		});

		const chat = await trpc.chat.getChat.query(first);
		expect(chat).not.toBeNull();
		expect(second.chatId).toBe(first.chatId);
	});

	it("edits a message and truncates the rest of the chat", async () => {
		const first = await trpc.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "User message" }]],
			metadata: [],
		});

		await trpc.message.createMessage.mutate({
			chat: first.chatId,
			author: "MODEL",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Model reply" }]],
			metadata: [],
		});

		await trpc.message.updateMessage.mutate({
			message: first.id,
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Edited user message" }]],
			metadata: [],
			truncate: true,
		});

		const { messages } = await trpc.message.getMessages.query({
			chat: first.chatId,
		});
		expect(messages).toHaveLength(1);
	});

	it("deletes the last message which deletes the chat", async () => {
		const first = await trpc.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "User message" }]],
			metadata: [],
		});

		await trpc.message.createMessage.mutate({
			chat: first.chatId,
			author: "MODEL",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Model reply" }]],
			metadata: [],
		});

		await trpc.message.deleteMessage.mutate({
			id: first.id,
		});

		const chat = await trpc.chat.getChat.query(first);
		expect(chat).toBeNull();
	});

	it("returns empty array for unknown chatId", async () => {
		const { messages } = await trpc.message.getMessages.query({ chat: null });
		expect(messages).toEqual([]);
	});
});
