import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { create_action } from "@tiny-chat/core/src/features/tool/tools/actions/create_action.ts";
import { describe, expect, inject, it } from "vitest";
import type { z } from "zod";
import { Author } from "../../../../generated/prisma/enums.ts";
import { testGenerationContext } from "../../../tests.helpers.ts";
import { testClient } from "../../../tests.ts";

const TEST_PROMPT = "WORKER_TEST";

describe("WorkerService", () => {
	it("creates an action and tests the worker", async () => {
		const { api } = testClient();
		const _user = await api.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Hello" }]],
			metadata: [],
		});
		const _model = await api.message.createMessage.mutate({
			chat: { id: _user.chatId },
			author: "MODEL",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Hello back" }]],
			metadata: [],
		});
		const chat = await api.chat.getChat.query({ id: _model.chatId });

		const output = await api.testing.tool.mutate({
			name: create_action.name,
			context: testGenerationContext({ chat, messages: [_user, _model] }),
			input: {
				schedule: "FREQ=DAILY;INTERVAL=1",
				prompt: TEST_PROMPT,
			} satisfies z.infer<typeof create_action.input>,
		});
		expect.assert(output[0].type === "json");
		const createdActionId = (
			output[0].value as z.infer<typeof create_action.output>
		).created_action_id;
		expect(createdActionId).toHaveLength(24);

		await api.testing.worker.mutate();

		const { messages } = await api.message.getMessages.query({ chat });

		const [prompt, response] = messages.slice(-2);
		expect(prompt.author).toBe(Author.USER);
		expect(DataUtils.getText(prompt)).toEqual(TEST_PROMPT);
		expect(response.author).toBe(Author.MODEL);
		expect(response.config.model).toBe(prompt.config.model);
		console.log("Worker response:", DataUtils.getText(response), response);
	});
});
