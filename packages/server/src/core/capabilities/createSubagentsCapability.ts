import type {
	CapabilityFactory,
	SubagentsCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import { CapabilityUtils } from "@tiny-chat/core/src/core/utils/CapabilityUtils.ts";
import type { zAgentChat } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import { ServerAgentService } from "../../features/agent/services/ServerAgentService.ts";

export const createSubagentsCapability: CapabilityFactory<
	{
		chat?: zAgentChat | null;
		message?: MessageState | null;
	},
	SubagentsCapability
> = async ({ chat, message }) => {
	return {
		runSubagent: async ({ context, instructions }) => {
			const { data } = await ServerAgentService.runAgent({
				chat: CapabilityUtils.require(chat?.id ? chat : null, "subagents"),
				context,
				prompt: CapabilityUtils.require(message, "subagents"),
				instructions,
			});
			return data;
		},
	};
};
