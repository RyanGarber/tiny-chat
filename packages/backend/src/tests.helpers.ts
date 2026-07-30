import type { zAgentContext } from "@tiny-chat/shared/src/features/agent/types/agent.ts";
import type { ChatState } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/shared/src/features/data/types/message.ts";
import type { TRPCClient } from "@trpc/client";
import { beforeAll, inject } from "vitest";
import type { tRPCRouter } from "./core/routes/index.ts";
import { testTRPC } from "./tests.ts";

// TODO WIP - tool use of prisma no longer routes through trpc
export function testGenerationContext(
	overrides: Partial<zAgentContext> = {},
): zAgentContext {
	const user = inject("backend_user");
	return {
		user: inject("backend_user"),
		chat: {
			id: "zzzzzzzzzzzzzzzzzzzzzzzz",
			userId: user.id,
			folderId: "zzzzzzzzzzzzzzzzzzzzzzzz",
			incognito: false,
		},
		messages: overrides.messages ?? [],
		timezone: "America/New_York",
		...overrides,
	};
}

export type TestChatData = {
	trpc: TRPCClient<tRPCRouter>;
	message: MessageState;
	chat: ChatState;
};
export function testChat(
	onBeforeAll: ({ trpc, message, chat }: TestChatData) => void,
) {
	const trpc = testTRPC();
	let message: MessageState;
	let chat: ChatState;

	beforeAll(async () => {
		message = await trpc.message.createMessage.mutate({
			author: "USER",
			config: inject("backend_config"),
			data: [[{ type: "text", value: "Hello" }]],
			metadata: [],
		});
		chat = await trpc.chat.getChat.query(message);

		onBeforeAll({ trpc, message, chat });
	});
}
