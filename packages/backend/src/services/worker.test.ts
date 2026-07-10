import { Author, type MessageState } from "@tiny-chat/shared/src/types/chat.ts";
import { texts } from "@tiny-chat/shared/src/utils.ts";
import { beforeAll, describe, expect, inject, it } from "vitest";
import type { Chat } from "../../generated/prisma/client.ts";
import { testTRPC } from "../tests.ts";
import {
	AddAction,
	type zAddActionInput,
	type zAddActionOutput,
} from "../tools/actions.ts";
import { testToolContext } from "../tools/index.test.ts";

export const workerTestPrompt = "WORKER_TEST";

describe("services - worker", () => {
	const trpc = testTRPC();

	let message: MessageState;
	let chat: Chat;

	beforeAll(async () => {
		message = await trpc.message.create.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Hello" }]],
			metadata: [],
		});
		chat = (await trpc.chat.find.query({ messageId: message.id })) as Chat;
	});

	it("creates an action and tests the worker", async () => {
		const output = await trpc.input.callTool.mutate({
			name: AddAction.name,
			context: testToolContext(chat, [message]),
			input: {
				schedule: "FREQ=DAILY;INTERVAL=1",
				prompt: workerTestPrompt,
			} satisfies zAddActionInput,
			userInput: undefined,
		});
		expect.assert(output[0].type === "json");
		const createdActionId = (output[0].value as zAddActionOutput)
			.created_action_id;
		expect(createdActionId).toHaveLength(24);

		await trpc.user.testWorker.mutate();

		const messages = await trpc.message.list.query({ chatId: chat.id });
		console.log(JSON.stringify(messages, null, 2));

		const [prompt, response] = messages.slice(-2);
		expect(prompt.author).toBe(Author.USER);
		expect(texts(prompt.data)).toBe(workerTestPrompt);
		expect(response.author).toBe(Author.MODEL);
		expect(response.config.model).toBe(prompt.config.model);
	});
});
