import { inspect } from "node:util";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import {
	type MessageState,
	zConfig,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { testUser } from "../../../tests.ts";
import { ActionService } from "../../chat/services/ActionService.ts";
import { ChatService } from "../../chat/services/ChatService.ts";
import { MessageService } from "../../message/services/MessageService.ts";
import { ActionRunnerService } from "./ActionRunnerService.ts";

const user = testUser();
const config = zConfig.parse({ provider: "test", model: "test-generate" });

const messageData: Pick<
	MessageState,
	"author" | "config" | "data" | "metadata"
>[] = [
	{
		author: "USER",
		config,
		data: [
			[
				{
					id: CommonUtils.getRandomId(),
					type: "text" as const,
					value: "Remind me to water the plants every day at 9am",
				},
			],
		],
		metadata: [],
	},
	{
		author: "MODEL",
		config,
		data: [
			[
				{
					id: CommonUtils.getRandomId(),
					type: "text",
					value: "Done! I will remind you starting tomorrow.",
				},
			],
		],
		metadata: [],
	},
];

const actionData: Omit<
	Parameters<typeof ActionService.createAction>[0],
	"message"
> = {
	user,
	data: [
		[
			{
				id: CommonUtils.getRandomId(),
				type: "text",
				value: "It's time to water your plants!",
			},
		],
	],
	schedule: "FREQ=DAILY;INTERVAL=1",
	timezone: "America/New_York",
};

describe("ActionRunnerService", () => {
	it("creates an action and tests the action", async () => {
		let previous: MessageState | undefined;
		for (const message of messageData) {
			previous = await MessageService.createMessage({
				chat: previous?.chatId,
				user,
				...message,
				previous: previous?.id,
			});
		}

		if (!previous) throw new Error("no messages created");

		const chat = await ChatService.getChat({ user, chat: previous.chatId });

		const action = await ActionService.createAction({
			...actionData,
			message: previous,
		});
		expect(action.lastRanAt).toBeFalsy();

		await ActionRunnerService.next({ testUserId: user.id });

		const { messages } = await MessageService.getMessages({ user, chat });
		expect(messages.length).toBe(4);

		const [userMessage, modelMessage] = messages.slice(-2);
		expect(userMessage.author).toBe("USER");
		expect(DataUtils.getText(userMessage)).toEqual(
			DataUtils.getText(actionData),
		);
		expect(modelMessage.author).toBe("MODEL");
		expect(modelMessage.config.model).toBe(config.model);
		console.log("action response:", inspect(modelMessage, { depth: null }));
	});
});
