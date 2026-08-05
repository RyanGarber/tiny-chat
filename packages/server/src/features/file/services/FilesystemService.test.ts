import { read_file } from "@tiny-chat/core/src/features/tool/tools/shell/read_file.ts";
import { shell_exec } from "@tiny-chat/core/src/features/tool/tools/shell/shell_exec.ts";
import { write_file } from "@tiny-chat/core/src/features/tool/tools/shell/write_file.ts";
import { beforeAll, describe, expect, inject, it } from "vitest";
import type { z } from "zod";
import { testGenerationContext } from "../../../tests.helpers.ts";
import { testClient } from "../../../tests.ts";

const { api } = testClient();

describe("services - dbfs", () => {
	let upload1: Awaited<
		ReturnType<(typeof api)["upload"]["createUpload"]["mutate"]>
	>;
	let upload2: Awaited<
		ReturnType<(typeof api)["upload"]["createUpload"]["mutate"]>
	>;
	let context: ReturnType<typeof testGenerationContext>;

	beforeAll(async () => {
		const data = new FormData();
		data.set("type", "ATTACHMENT");
		data.set(
			"file",
			new File(["Files suck. I hate files."], "question space.md"),
		);
		upload1 = await api.upload.createUpload.mutate(data);
		data.set(
			"file",
			new File(["Files suck. I hate files."], "question nbsp.md"),
		);
		upload2 = await api.upload.createUpload.mutate(data);
		const message = await api.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[upload1, upload2]],
			metadata: [],
		});
		const chat = await api.chat.getChat.query(message);
		if (!chat) throw new Error("Test chat not found");
		context = testGenerationContext({ chat, messages: [message] });
	});

	const exec = async (
		command: string,
	): Promise<z.infer<typeof shell_exec.output>> => {
		const output = await api.test.tool.mutate({
			name: `chat_${shell_exec.name}`,
			context,
			input: {
				command,
			} satisfies z.infer<typeof shell_exec.input>,
		});
		expect.assert(output[0].type === "json");
		console.log(`---\n$ ${command}\n`, output[0].value, "\n---");
		return output[0].value as z.infer<typeof shell_exec.output>;
	};

	it("finds the upload in `ls -l`", async () => {
		const output = await exec("ls -l /mnt/chat");
		expect(output.stdout).toContain(upload1.id);
	});

	it("finds the uploaded file in `ls -l`", async () => {
		const output = await exec(`ls -l ${upload1.id}`);
		expect(output.stdout).toContain("question space.md");
	});

	it("finds the file in `ls -l`", async () => {
		const output = await exec(`ls -l /mnt/chat/${upload2.id}`);
		expect(output.stdout).toContain(".md");
	});

	it("reads a file with nbsp", async () => {
		const output = await api.test.tool.mutate({
			name: `chat_${read_file.name}`,
			context,
			input: {
				path: `/mnt/chat/${upload2.id}/${upload2.name}`,
			} satisfies z.infer<typeof read_file.input>,
		});
		expect.assert(output[0].type === "file");
		expect(output[0].name).toEqual("question nbsp.md");
	});

	it("writes a file to the chat", async () => {
		let output = await exec('echo "Hello, world!" > /mnt/chat/hello.txt');
		expect(output.stderr.trim().length).toBe(0);
		output = await exec("cat /mnt/chat/hello.txt");
		expect(output.stdout).toContain("Hello, world!");
	});

	it("writes a file to the chat using python", async () => {
		let output = await exec(
			"python3 -c \"import os; print(os.getcwd()); f = open('hello.txt', 'w'); f.write('Hello, world!'); f.close()\"",
		);
		expect(output.stdout).toContain("/mnt/chat");
		output = await exec("cat /mnt/chat/hello.txt");
		expect(output.stdout).toContain("Hello, world!");
	});

	it("applies a chat file over a base file", async () => {
		const data = new FormData();
		data.set("type", "ATTACHMENT");
		data.set("file", new File(["uploadFile1"], "uploadFile1.txt"));
		const upload1 = await api.upload.createUpload.mutate(data);

		const message = await api.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[upload1]],
			metadata: [],
		});
		const chat = await api.chat.getChat.query(message);
		if (!chat) throw new Error("Test chat not found");

		await api.test.tool.mutate({
			name: `chat_${write_file.name}`,
			context: testGenerationContext({ chat, messages: [message] }),
			input: {
				path: `/mnt/chat/${upload1.id}/uploadFile1.txt`,
				content: "uploadFile1\nnewline",
			} satisfies z.infer<typeof write_file.input>,
		});

		await api.test.tool.mutate({
			name: `chat_${write_file.name}`,
			context: testGenerationContext({ chat, messages: [message] }),
			input: {
				path: `/mnt/chat/file1.txt`,
				content: "file1\nnewline",
			} satisfies z.infer<typeof write_file.input>,
		});

		const files = await api.file.getFiles.query({
			chat: chat.id,
		});

		expect(files.length).toBeTruthy();
		expect(files.find((file) => file.uploadId === upload1.id)).toBeTruthy();

		const uploadFile1 = files.find((f) => f.path.includes("uploadFile1.txt"));

		console.log(JSON.stringify(uploadFile1));
		expect.assert(uploadFile1?.chatFile && uploadFile1?.uploadFile);
		expect(uploadFile1.chatFile.lines).toBe(2);
		expect(uploadFile1.uploadFile.lines).toBe(1);

		const file1 = files.find((f) => f.path.includes("file1.txt"));
		expect.assert(file1?.chatFile && !file1?.uploadFile);
		expect(file1.chatFile.lines).toBe(2);
	});
});
