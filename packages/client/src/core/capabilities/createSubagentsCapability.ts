import type { Client } from "#client/client.ts";
import { AgentStreamService } from "#client/core/services/StreamService.ts";
import { ClientAgentService } from "#client/features/agent/services/ClientAgentService.ts";
import type {
	CapabilityFactory,
	SubagentsCapability,
} from "#core/core/types/capability.ts";
import { CapabilityUtils } from "#core/core/utils/CapabilityUtils.ts";
import type { zAgentChat } from "#core/features/agent/types/agent.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "#core/features/provider/types/provider.ts";
import type { zSkill } from "#core/features/skill/types/skill.ts";
import type { Toolset } from "#core/features/tool/types/tool.ts";

export const createSubagentsCapability: CapabilityFactory<
	{
		client: Client;
		chat?: zAgentChat | null;
		message?: MessageState | null;
		providers: ProviderState<ProviderStatus>[];
		skills: zSkill[];
		mcpTools: Toolset<any>[];
	},
	SubagentsCapability
> = async ({ client, chat, message, providers, skills, mcpTools }) => {
	return {
		runSubagent: async ({ context, instructions, onData }) => {
			const streamKey = Math.random().toString(36);
			AgentStreamService.subscribe(streamKey, () => {
				const state = AgentStreamService.get(streamKey)?.items.at(-1);
				if (state) onData(state.data);
			});
			try {
				const { data } = await ClientAgentService.runAgent({
					client,
					context,
					chat: CapabilityUtils.require(chat?.id ? chat : null, "subagents"),
					prompt: CapabilityUtils.require(message, "subagents"),
					skills,
					mcpTools,
					providers,
					streamKey,
					streamChat: null,
					instructions,
				});
				return data;
			} finally {
				AgentStreamService.clear(streamKey);
			}
		},
	};
};
