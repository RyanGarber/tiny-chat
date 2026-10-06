import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { mockConfig } from "#core/tests.ts";
import { ChatService } from "#server/features/chat/services/ChatService.ts";
import { FileService } from "#server/features/file/services/FileService.ts";
import { MessageService } from "#server/features/message/services/MessageService.ts";
import { SettingsService } from "#server/features/user/services/SettingsService.ts";
import { testUser } from "#server/tests.ts";

const user = testUser();

const setProjectFolder = async (project: { id: string }, folder: string) => {
	await SettingsService.setSettings({
		user,
		project,
		update: (settings) => ({
			...settings,
			folders: [{ path: folder, whitelist: false }],
		}),
	});
};

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

	expect((await exec("pwd")).stdout.trim()).toBe("/mnt");

	await exec(`cd /mnt/chat/${chat.id}`);
	expect((await exec("pwd")).stdout.trim()).toBe(`/mnt/chat/${chat.id}`);

	await exec("echo hello > sample.txt");
	expect((await exec("cat sample.txt")).stdout.trim()).toBe("hello");

	await setProjectFolder(project, `/mnt/chat/${chat.id}`);
	FileService.activate(user.id, chat.id);
	expect((await exec("pwd")).stdout.trim()).toBe(`/mnt/chat/${chat.id}`);

	await exec("cd /mnt");
	expect(await FileService.cwd({ user, chat: chat.id })).toBe("/mnt");

	await setProjectFolder(project, "/mnt/missing");
	FileService.activate(user.id, chat.id);
	expect((await exec("pwd")).stdout.trim()).toBe("/mnt");

	await exec(`cd /mnt/chat/${chat.id}`);
	const chat2 = await testChat(null);
	expect(
		(
			await FileService.exec({ user, chat: chat2.id, command: "pwd" })
		).stdout.trim(),
	).toBe("/mnt");

	const parallel = await Promise.all([exec("cd /mnt"), exec("pwd")]);
	expect(parallel[1].stdout.trim()).toBe("/mnt");
}, 30_000);

it("stops a running command when it is aborted, and keeps the shell", async () => {
	const chat = await testChat(null);
	const abort = new AbortController();

	const started = Date.now();
	setTimeout(() => abort.abort(), 500);
	await FileService.exec({
		user,
		chat: chat.id,
		command: "sleep 30",
		abort: abort.signal,
	}).catch(() => {});
	expect(Date.now() - started).toBeLessThan(5_000);

	// The chat's queue is not left waiting on it.
	const after = await FileService.exec({ user, chat: chat.id, command: "pwd" });
	expect(after.stdout.trim()).toBe("/mnt");
});
