import type {
	CapabilityFactory,
	SubagentsCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import { ServerAgentService } from "../../features/agent/services/ServerAgentService.ts";

export const createSubagentsCapability: CapabilityFactory<
	{
		chat: ChatState;
		message: MessageState;
	},
	SubagentsCapability
> = async ({ chat, message }) => {
	return {
		runSubagent: async ({ context, config }) => {
			const { data } = await ServerAgentService.runAgent({
				chat,
				config,
				context,
				prompt: message,
			});
			return data;
		},
	};
};
