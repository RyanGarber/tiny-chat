import type { Capabilities } from "@tiny-chat/core/src/core/types/capability.ts";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import type { zChat } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { WebProviderService } from "@tiny-chat/core/src/features/provider/services/WebProviderService.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { zWebFeature } from "@tiny-chat/core/src/features/provider/types/web.ts";
import { ProviderUtils } from "@tiny-chat/core/src/features/provider/utils/ProviderUtils.ts";
import { CacheService } from "../../features/user/services/CacheService.ts";
import { createActionsCapability } from "../capabilities/createActionsCapability.ts";
import { createChatShellCapability } from "../capabilities/createChatShellCapability.ts";
import { createEmbeddingCapability } from "../capabilities/createEmbeddingCapability.ts";
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
		chat: zChat | null | undefined;
		message: MessageState | null | undefined;
		/** What the mount is built from; a chat only adds somewhere to write. */
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		temporary: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}): Promise<Capabilities> => {
		const capabilities: Capabilities = {};

		if (message?.id && !incognito && !temporary) {
			capabilities.actions = await createActionsCapability({
				user,
				message,
			});
		}

		if (!incognito && !temporary) {
			capabilities.memories = await createMemoriesCapability({
				user,
				message,
			});
		}

		capabilities.chatShell = await createChatShellCapability({
			user,
			chat: chat?.id,
			...AgentUtils.getMounts({ messages: messages ?? [] }),
		});

		providers ??= (await CacheService.getCache({ user })).providers;

		if (ProviderUtils.isValid(providers, user.settings.embeddingConfig)) {
			capabilities.embedding = await createEmbeddingCapability({ user });
		}

		if (
			chat?.id &&
			message?.id &&
			ProviderUtils.isValid(providers, user.settings.subagentConfig)
		) {
			capabilities.subagents = await createSubagentsCapability({
				chat,
				message,
			});
		}

		const web = (["search", "view"] satisfies zWebFeature[]).some((feature) =>
			WebProviderService.getBestProvider({
				user,
				providers,
				feature,
			}),
		);

		if (web) {
			capabilities.web = await createWebCapability({ user });
		}

		return capabilities;
	},
} as const;
