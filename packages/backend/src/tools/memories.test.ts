import type {
	Chat,
	MessageState,
	zToolResultValue,
} from "@tiny-chat/shared/src/types/chat.ts";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { testTRPC } from "../tests.ts";
import { testToolContext } from "./index.test.ts";
import {
	AddMemory,
	SearchMemory,
	type zAddMemoryInput,
	type zSearchMemoryInput,
	type zSearchMemoryOutput,
} from "./memories.ts";

describe("tools - memories", async () => {
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

	it("creates a memory and lists it", async () => {
		const fact = "The user likes ice cream.";

		let output: zToolResultValue = await trpc.input.callTool.mutate({
			name: AddMemory.name,
			context: testToolContext(chat, [message]),
			input: {
				fact,
				category: "PREFERENCES",
				stability: "LONG_TERM",
				evidence: "User mentioned liking ice cream in a previous chat.",
				confidence: 0.9,
			} satisfies zAddMemoryInput,
			userInput: undefined,
		});
		expect.assert(output[0].type === "json");

		output = await trpc.input.callTool.mutate({
			name: SearchMemory.name,
			context: testToolContext(chat, [message]),
			input: {
				query: "ice cream",
				mode: "semantic",
			} satisfies zSearchMemoryInput,
			userInput: undefined,
		});
		expect.assert(output[0].type === "json");
		expect(
			(output[0].value as zSearchMemoryOutput).map((m) => m.fact),
		).toContainEqual(fact);
	});
});
