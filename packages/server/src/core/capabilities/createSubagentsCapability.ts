import type {
	CapabilityFactory,
	SubagentsCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { zChat } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import { ServerAgentService } from "../../features/agent/services/ServerAgentService.ts";

export const createSubagentsCapability: CapabilityFactory<
	{
		chat: zChat;
		message: MessageState;
	},
	SubagentsCapability
> = async ({ chat, message }) => {
	return {
		runSubagent: async ({ context, instructions }) => {
			const { data } = await ServerAgentService.runAgent({
				chat,
				context,
				prompt: message,
				instructions,
			});
			return data;
		},
	};
};
