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
import { CacheService } from "../../features/user/services/CacheService.ts";
import { createActionsCapability } from "../capabilities/createActionsCapability.ts";
import { createChatShellCapability } from "../capabilities/createChatShellCapability.ts";
import { createEmbeddingCapability } from "../capabilities/createEmbeddingCapability.ts";
import { createGitHubCapability } from "../capabilities/createGitHubCapability.ts";
import { createMemoriesCapability } from "../capabilities/createMemoriesCapability.ts";
import { createSubagentsCapability } from "../capabilities/createSubagentsCapability.ts";
import { createWebCapability } from "../capabilities/createWebCapability.ts";

export const ServerCapabilityService = {
	getCapabilities: async ({
		user,
		chat,
		message,
		messages,
		incognito,
		temporary,
		providers,
	}: {
		user: zUser;
		chat: zAgentChat | null | undefined;
		message: MessageState | null | undefined;
		/** What the mount is built from; a chat only adds somewhere to write. */
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		temporary: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}): Promise<Capabilities> => {
		providers ??= (await CacheService.getCache({ user })).providers;

		const enabled = CapabilityUtils.getEnabled({
			user,
			providers,
			folder: chat?.folder,
			chat: !!chat?.id,
			message: !!message?.id,
			incognito,
			temporary,
			// The worker runs nowhere near the user's own machine.
			desktop: false,
		});

		const capabilities: Capabilities = {};

		if (enabled.chatShell) {
			capabilities.chatShell = await createChatShellCapability({
				user,
				chat: chat?.id,
				...AgentUtils.getMounts({ messages: messages ?? [] }),
			});
		}

		if (enabled.github) {
			capabilities.github = await createGitHubCapability({
				user,
				preferLinkedAccount: !incognito,
			});
		}

		if (enabled.actions) {
			capabilities.actions = await createActionsCapability({ user, message });
		}

		if (enabled.memories) {
			capabilities.memories = await createMemoriesCapability({ user, message });
		}

		if (enabled.embedding) {
			capabilities.embedding = await createEmbeddingCapability({ user });
		}

		if (enabled.subagents) {
			capabilities.subagents = await createSubagentsCapability({
				chat,
				message,
			});
		}

		if (enabled.web) {
			capabilities.web = await createWebCapability({ user });
		}

		return capabilities;
	},
} as const;
