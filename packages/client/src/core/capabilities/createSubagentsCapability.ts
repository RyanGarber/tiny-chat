import type {
	CapabilityFactory,
	SubagentsCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { zSkill } from "@tiny-chat/core/src/features/skill/types/skill.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import type { Client } from "../../client.ts";
import { ClientAgentService } from "../../features/agent/services/ClientAgentService.ts";
import { AgentStreamService } from "../services/StreamService.ts";

export const createSubagentsCapability: CapabilityFactory<
	{
		client: Client;
		chat: ChatState;
		message: MessageState;
		providers: ProviderState<ProviderStatus>[];
		skills: zSkill[];
		mcpTools: Toolset<any>[];
	},
	SubagentsCapability
> = async ({ client, chat, message, providers, skills, mcpTools }) => {
	return {
		runSubagent: async ({ context, onData }) => {
			const streamKey = Math.random().toString(36);
			AgentStreamService.subscribe(streamKey, () => {
				const state = AgentStreamService.get(streamKey)?.items.at(-1);
				if (state) onData(state.data);
			});
			try {
				const { data } = await ClientAgentService.runAgent({
					client,
					context,
					chat,
					prompt: message,
					skills,
					mcpTools,
					providers,
					streamKey,
					streamChat: null,
				});
				return data;
			} finally {
				AgentStreamService.clear(streamKey);
			}
		},
	};
};
