import { DataUtils } from "@tiny-chat/shared/src/features/data/utils/DataUtils.ts";
import { create_action } from "@tiny-chat/shared/src/features/tool/tools/actions/create_action.ts";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { Author } from "../../../../generated/prisma/enums.ts";
import {
	type TestChatData,
	testChat,
	testGenerationContext,
} from "../../../tests.helpers.ts";

export const workerTestPrompt = "WORKER_TEST";

describe("services - worker", () => {
	let testData: TestChatData;
	testChat((data) => (testData = data));

	it("creates an action and tests the worker", async () => {
		const { trpc, message, chat } = testData;

		const output = await trpc.test.tool.mutate({
			name: create_action.name,
			context: testGenerationContext({ chat, messages: [message] }),
			input: {
				schedule: "FREQ=DAILY;INTERVAL=1",
				prompt: workerTestPrompt,
			} satisfies z.infer<typeof create_action.input>,
		});
		expect.assert(output[0].type === "json");
		const createdActionId = (
			output[0].value as z.infer<typeof create_action.output>
		).created_action_id;
		expect(createdActionId).toHaveLength(24);

		await trpc.test.worker.mutate();

		const { messages } = await trpc.message.getMessages.query({ chat });
		console.log(JSON.stringify(messages, null, 2));

		const [prompt, response] = messages.slice(-2);
		expect(prompt.author).toBe(Author.USER);
		expect(DataUtils.getText(prompt)).toBe(workerTestPrompt);
		expect(response.author).toBe(Author.MODEL);
		expect(response.config.model).toBe(prompt.config.model);
	});
});
