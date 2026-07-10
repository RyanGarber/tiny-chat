import type {
	zReadFileInput,
	zShellExecInput,
	zShellExecOutput,
} from "@tiny-chat/shared/src/tools/system.ts";
import type { zToolContext } from "@tiny-chat/shared/src/types/tool.ts";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { testTRPC } from "../tests.ts";
import { ReadFile, ShellExec } from "../tools/chat.ts";
import { testToolContext } from "../tools/index.test.ts";

const trpc = testTRPC();

describe("services - dbfs", () => {
	let upload1: Awaited<
		ReturnType<(typeof trpc)["input"]["createUpload"]["mutate"]>
	>;
	let upload2: Awaited<
		ReturnType<(typeof trpc)["input"]["createUpload"]["mutate"]>
	>;
	let context: zToolContext;

	beforeAll(async () => {
		const data = new FormData();
		data.set("type", "ATTACHMENT");
		data.set(
			"file",
			new File(["Files suck. I hate files."], "question space.md"),
		);
		upload1 = await trpc.input.createUpload.mutate(data);
		data.set(
			"file",
			new File(["Files suck. I hate files."], "question nbsp.md"),
		);
		upload2 = await trpc.input.createUpload.mutate(data);
		const message = await trpc.message.create.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[upload1, upload2]],
			metadata: [],
		});
		const chat = await trpc.chat.find.query({ messageId: message.id });
		if (!chat) throw new Error("Test chat not found");
		context = testToolContext(chat, [message]);
	});

	it("finds the upload in `ls -l`", async () => {
		const output = await trpc.input.callTool.mutate({
			name: ShellExec.name,
			context,
			input: {
				command: "ls -l /mnt/chat",
				chat: true,
			} satisfies zShellExecInput,
			userInput: undefined,
		});
		expect.assert(output[0].type === "json");
		expect((output[0].value as zShellExecOutput).stdout).toContain(upload1.id);
	});

	it("finds the uploaded file in `ls -l`", async () => {
		const output = await trpc.input.callTool.mutate({
			name: ShellExec.name,
			context,
			input: {
				command: `ls -l ${upload1.id}`,
				chat: true,
			} satisfies zShellExecInput,
			userInput: undefined,
		});
		expect.assert(output[0].type === "json");
		expect((output[0].value as zShellExecOutput).stdout).toContain(
			"question space.md",
		);
	});

	it("writes a file to the chat", async () => {
		await trpc.input.callTool.mutate({
			name: ShellExec.name,
			context,
			input: {
				command: `echo "Hello, world!" > /mnt/chat/hello.txt`,
				chat: true,
			} satisfies zShellExecInput,
			userInput: undefined,
		});
		const output = await trpc.input.callTool.mutate({
			name: ShellExec.name,
			context,
			input: {
				command: `cat /mnt/chat/hello.txt`,
				chat: true,
			} satisfies zShellExecInput,
			userInput: undefined,
		});
		expect.assert(output[0].type === "json");
		expect((output[0].value as zShellExecOutput).stdout).toBe(
			"Hello, world!\n",
		);
	});

	it("finds the file in `ls -l`", async () => {
		const output = await trpc.input.callTool.mutate({
			name: ShellExec.name,
			context,
			input: {
				command: `ls -l /mnt/chat/${upload2.id}`,
				chat: true,
			} satisfies zShellExecInput,
			userInput: undefined,
		});
		expect.assert(output[0].type === "json");
		console.log(output[0].value);
		expect((output[0].value as zShellExecOutput).stdout).toContain(".md");
	});

	it("reads a file with nbsp", async () => {
		const output = await trpc.input.callTool.mutate({
			name: ReadFile.name,
			context,
			input: {
				path: `/mnt/chat/${upload2.id}/${upload2.name}`,
			} satisfies zReadFileInput,
			userInput: undefined,
		});
		expect.assert(output[0].type === "file");
		console.log(output[0]);
		expect(output[0].name).toEqual("question nbsp.md");
	});

	it("runs a python script", async () => {
		const output = await trpc.input.callTool.mutate({
			name: ShellExec.name,
			context,
			input: {
				command: `python3 -c "import os; print(os.getcwd()); f = open('hello.txt', 'w'); f.write('Hello, world!'); f.close()"`,
				chat: true,
			} satisfies zShellExecInput,
			userInput: undefined,
		});
		expect.assert(output[0].type === "json");
		console.log(output[0].value);
		expect((output[0].value as zShellExecOutput).stdout).toContain("/mnt/chat");

		const output2 = await trpc.input.callTool.mutate({
			name: ShellExec.name,
			context,
			input: {
				command: "cat /mnt/chat/hello.txt",
				chat: true,
			} satisfies zShellExecInput,
			userInput: undefined,
		});
		expect.assert(output2[0].type === "json");
		console.log(output2[0].value);
		expect((output2[0].value as zShellExecOutput).stdout).toContain(
			"Hello, world!",
		);
	});
});
