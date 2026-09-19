import type { Capabilities } from "@tiny-chat/core/src/core/types/capability.ts";
import { CapabilityUtils } from "@tiny-chat/core/src/core/utils/CapabilityUtils.ts";
import type {
	zAgentChat,
	zAgentMessage,
} from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { zSkill } from "@tiny-chat/core/src/features/skill/types/skill.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import type { Client } from "../../client.ts";
import { ClientProviderService } from "../../features/agent/services/ClientProviderService.ts";
import { createActionsCapability } from "../capabilities/createActionsCapability.ts";
import { createChatShellCapability } from "../capabilities/createChatShellCapability.ts";
import { createEmbeddingCapability } from "../capabilities/createEmbeddingCapability.ts";
import { createGitHubCapability } from "../capabilities/createGitHubCapability.ts";
import { createMemoriesCapability } from "../capabilities/createMemoriesCapability.ts";
import { createShellCapability } from "../capabilities/createShellCapability.ts";
import { createSubagentsCapability } from "../capabilities/createSubagentsCapability.ts";
import { createWebCapability } from "../capabilities/createWebCapability.ts";

export const ClientCapabilityService = {
	getCapabilities: async ({
		client,
		user,
		chat,
		message,
		messages,
		incognito,
		temporary,
		providers,
		skills = [],
		mcpTools = [],
		presumed = false,
	}: {
		client: Client;
		user: zUser;
		chat: zAgentChat | null | undefined;
		message: MessageState | null | undefined;
		/** What the mount is built from; a chat only adds somewhere to write. */
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		temporary: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
		skills?: zSkill[];
		mcpTools?: Toolset<any>[];
		/**
		 * Gate as if the chat and the prompt message already existed, for working
		 * out what a message costs before it is sent. The capabilities are still
		 * built from what exists now, so the ones that would write to a message
		 * that is not there yet are built unable to.
		 */
		presumed?: boolean;
	}): Promise<Capabilities> => {
		providers ??= await ClientProviderService.getProviderStates({
			client,
			user,
		});

		const enabled = CapabilityUtils.getEnabled({
			user,
			providers,
			folder: chat?.folder,
			chat: presumed || !!chat?.id,
			message: presumed || !!message?.id,
			incognito,
			temporary,
			desktop: !!client.desktop,
		});

		const capabilities: Capabilities = {};

		if (enabled.chatShell) {
			capabilities.chatShell = await createChatShellCapability({
				client,
				chat: chat?.id,
				...AgentUtils.getMounts({ messages: messages ?? [] }),
			});
		}

		if (enabled.github) {
			capabilities.github = await createGitHubCapability({
				client,
				preferLinkedAccount: !incognito,
			});
		}

		if (enabled.shell) {
			capabilities.shell = await createShellCapability({ client });
		}

		if (enabled.actions) {
			capabilities.actions = await createActionsCapability({ client, message });
		}

		if (enabled.memories) {
			capabilities.memories = await createMemoriesCapability({
				client,
				message,
			});
		}

		if (enabled.embedding) {
			capabilities.embedding = await createEmbeddingCapability({
				client,
				user,
			});
		}

		if (enabled.subagents) {
			capabilities.subagents = await createSubagentsCapability({
				client,
				chat,
				message,
				providers,
				skills,
				mcpTools,
			});
		}

		if (enabled.web) {
			capabilities.web = await createWebCapability({ client });
		}

		return capabilities;
	},
} as const;
