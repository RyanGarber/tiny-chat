import type {
	CapabilityFactory,
	SubagentsCapability,
} from "#core/core/types/capability.ts";
import { CapabilityUtils } from "#core/core/utils/CapabilityUtils.ts";
import type { zAgentChat } from "#core/features/agent/types/agent.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import { ServerAgentService } from "#server/features/agent/services/ServerAgentService.ts";
import { SubagentService } from "#server/features/agent/services/SubagentService.ts";

export const createSubagentsCapability: CapabilityFactory<
	{
		chat?: zAgentChat | null;
		message?: MessageState | null;
	},
	SubagentsCapability
> = async ({ chat, message }) => {
	return {
		runSubagent: async ({ part, context, instructions }) => {
			const { data, metadata } = await ServerAgentService.runAgent({
				chat: CapabilityUtils.require(chat?.id ? chat : null, "subagents"),
				context,
				prompt: CapabilityUtils.require(message, "subagents"),
				instructions,
			});
			if (part)
				await SubagentService.saveSubagent({
					user: context.user,
					part: part.id,
					message: part.message,
					data,
					metadata,
				});
			return data;
		},
	};
};
