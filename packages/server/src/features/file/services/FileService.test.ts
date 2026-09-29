import assert from "node:assert/strict";
import { CommonUtils } from "@tiny-chat/core/core/utils/CommonUtils.ts";
import { mockConfig } from "@tiny-chat/core/tests.ts";
import { testUser } from "../../../tests.ts";
import { ChatService } from "../../chat/services/ChatService.ts";
import { MessageService } from "../../message/services/MessageService.ts";
import { SettingsService } from "../../user/services/SettingsService.ts";
import { FileService } from "./FileService.ts";

const user = testUser();

const setProjectFolder = (project: { id: string }, folder: string) =>
	SettingsService.setSettings({
		user,
		project,
		update: (settings) => ({
			...settings,
			folders: [{ path: folder, writable: false }],
		}),
	});

const testChat = async (projectId: string | null) => {
	const { chatId } = await MessageService.createMessage({
		user,
		projectId,
		author: "USER",
		config: mockConfig(),
		data: [
			[{ id: CommonUtils.getRandomId(), type: "text", value: "cwd test" }],
		],
		metadata: [],
	});
	return await ChatService.getChat({ user, chat: chatId });
};

it("preserves chat cwd, refreshes files, and resets on activation with isolated serialized shells", async () => {
	const project = await ChatService.createProject({ user, title: "cwd test" });
	await setProjectFolder(project, "/mnt");

	const chat = await testChat(project.id);
	const exec = (command: string) =>
		FileService.exec({ user, chat: chat.id, command });
	assert.equal((await exec("pwd")).stdout.trim(), "/mnt");
	await exec(`cd /mnt/chat/${chat.id}`);
	assert.equal((await exec("pwd")).stdout.trim(), `/mnt/chat/${chat.id}`);
	await exec("echo hello > sample.txt");
	assert.equal((await exec("cat sample.txt")).stdout.trim(), "hello");
	await setProjectFolder(project, `/mnt/chat/${chat.id}`);
	FileService.activate(user.id, chat.id);
	assert.equal((await exec("pwd")).stdout.trim(), `/mnt/chat/${chat.id}`);
	await exec("cd /mnt");
	assert.equal(await FileService.cwd({ user, chat: chat.id }), "/mnt");
	await setProjectFolder(project, "/mnt/missing");
	FileService.activate(user.id, chat.id);
	assert.equal((await exec("pwd")).stdout.trim(), "/mnt");
	await exec(`cd /mnt/chat/${chat.id}`);
	const chat2 = await testChat(null);
	assert.equal(
		(
			await FileService.exec({ user, chat: chat2.id, command: "pwd" })
		).stdout.trim(),
		"/mnt",
	);
	const parallel = await Promise.all([exec("cd /mnt"), exec("pwd")]);
	assert.equal(parallel[1].stdout.trim(), "/mnt");
}, 30_000);
