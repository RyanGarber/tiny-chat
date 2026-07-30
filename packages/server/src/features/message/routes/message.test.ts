import { describe, expect, inject, it } from "vitest";
import { testClient } from "../../../tests.ts";

describe("routes - message", () => {
	const { api } = testClient();

	it("creates a new chat with two messages", async () => {
		const first = await api.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "First message" }]],
			metadata: [],
		});

		const second = await api.message.createMessage.mutate({
			chat: first.chatId,
			author: "MODEL",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Reply from model" }]],
			metadata: [],
		});

		const chat = await api.chat.getChat.query(first);
		expect(chat).not.toBeNull();
		expect(second.chatId).toBe(first.chatId);
	});

	it("edits a message and truncates the rest of the chat", async () => {
		const first = await api.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "User message" }]],
			metadata: [],
		});

		await api.message.createMessage.mutate({
			chat: first.chatId,
			author: "MODEL",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Model reply" }]],
			metadata: [],
		});

		await api.message.updateMessage.mutate({
			message: first.id,
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Edited user message" }]],
			metadata: [],
			truncate: true,
		});

		const { messages } = await api.message.getMessages.query({
			chat: first.chatId,
		});
		expect(messages).toHaveLength(1);
	});

	it("deletes the last message which deletes the chat", async () => {
		const first = await api.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "User message" }]],
			metadata: [],
		});

		await api.message.createMessage.mutate({
			chat: first.chatId,
			author: "MODEL",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Model reply" }]],
			metadata: [],
		});

		await api.message.deleteMessage.mutate({
			id: first.id,
		});

		const chat = await api.chat.getChat.query(first);
		expect(chat).toBeNull();
	});

	it("returns empty array for unknown chatId", async () => {
		const { messages } = await api.message.getMessages.query({ chat: null });
		expect(messages).toEqual([]);
	});
});
