import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { describe, expect, inject, it } from "vitest";
import { testClient } from "../../../tests.ts";

describe("message", () => {
	const { api } = testClient();

	it("keeps new chats folderless and preserves manually created empty folders", async () => {
		const content = {
			author: "USER" as const,
			config: inject("server_config"),
			data: [],
			metadata: [],
		};
		const folder = await api.chat.createFolder.mutate({});
		expect(folder.title).toBeNull();
		expect(
			(await api.chat.getChatList.query()).folders.find(
				(item) => item.id === folder.id,
			)?.chats,
		).toEqual([]);
		const recent = await api.message.createMessage.mutate(content);
		expect((await api.chat.getChat.query(recent)).folderId).toBeNull();
		const nested = await api.message.createMessage.mutate({
			...content,
			folderId: folder.id,
		});
		expect((await api.chat.getChat.query(nested)).folderId).toBe(folder.id);
		const list = await api.chat.getChatList.query({});
		expect(list.chats.some((item) => item.id === recent.chatId)).toBe(true);
		expect(list.chats.some((item) => item.id === nested.chatId)).toBe(false);
		expect(
			list.folders
				.find((item) => item.id === folder.id)
				?.chats.map((item) => item.id),
		).toEqual([nested.chatId]);
		await api.message.deleteMessage.mutate(nested);
		expect(
			(await api.chat.getChatList.query({})).folders.find(
				(item) => item.id === folder.id,
			)?.chats,
		).toEqual([]);
		await expect(
			api.message.createMessage.mutate({
				...content,
				folderId: CommonUtils.getRandomId(),
			}),
		).rejects.toThrow();
		await api.chat.deleteChat.mutate({ id: recent.chatId });
	});

	it("creates a new chat with two messages", async () => {
		const first = await api.message.createMessage.mutate({
			author: "USER",
			config: inject("server_config"),
			data: [
				[
					{
						id: CommonUtils.getRandomId(),
						type: "text",
						value: "First message",
					},
				],
			],
			metadata: [],
		});

		const second = await api.message.createMessage.mutate({
			chat: first.chatId,
			author: "MODEL",
			config: inject("server_config"),
			data: [
				[
					{
						id: CommonUtils.getRandomId(),
						type: "text",
						value: "Reply from model",
					},
				],
			],
			metadata: [],
		});

		const chat = await api.chat.getChat.query(first);
		expect(chat).not.toBeNull();
		expect(second.chatId).toBe(first.chatId);
	});

	it("edits onto a new branch without deleting the original", async () => {
		const first = await api.message.createMessage.mutate({
			author: "USER",
			config: inject("server_config"),
			data: [
				[
					{
						id: CommonUtils.getRandomId(),
						type: "text",
						value: "User message",
					},
				],
			],
			metadata: [],
		});

		await api.message.createMessage.mutate({
			chat: first.chatId,
			author: "MODEL",
			config: inject("server_config"),
			data: [
				[{ id: CommonUtils.getRandomId(), type: "text", value: "Model reply" }],
			],
			metadata: [],
		});

		const edited = await api.message.editMessage.mutate({
			message: first.id,
			author: "USER",
			config: inject("server_config"),
			data: [
				[
					{
						id: CommonUtils.getRandomId(),
						type: "text",
						value: "Edited user message",
					},
				],
			],
			metadata: [],
			truncate: true,
		});

		const { messages } = await api.message.getMessages.query({
			chat: first.chatId,
			start: edited.id,
		});
		expect(messages).toHaveLength(1);
		expect(edited.id).not.toBe(first.id);
		expect(
			(await api.message.getMessages.query({ chat: first.chatId })).messages,
		).toHaveLength(2);
	});

	it("deletes the last message which deletes the chat", async () => {
		const first = await api.message.createMessage.mutate({
			author: "USER",
			config: inject("server_config"),
			data: [
				[
					{
						id: CommonUtils.getRandomId(),
						type: "text",
						value: "User message",
					},
				],
			],
			metadata: [],
		});

		await api.message.createMessage.mutate({
			chat: first.chatId,
			author: "MODEL",
			config: inject("server_config"),
			data: [
				[{ id: CommonUtils.getRandomId(), type: "text", value: "Model reply" }],
			],
			metadata: [],
		});

		await api.message.deleteMessage.mutate({
			id: first.id,
		});

		const chat = await api.chat.getChatList.query({});
		expect(
			[...chat.chats, ...chat.folders.flatMap((folder) => folder.chats)].filter(
				(chat) => chat.id === first.chatId,
			),
		).toHaveLength(0);
	});

	it("returns empty array for unknown chatId", async () => {
		const { messages } = await api.message.getMessages.query({ chat: null });
		expect(messages).toEqual([]);
	});
});
