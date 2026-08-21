import type { Capabilities } from "@tiny-chat/core/src/core/types/capability.ts";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageState } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { WebProviderService } from "@tiny-chat/core/src/features/provider/services/WebProviderService.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { zWebFeature } from "@tiny-chat/core/src/features/provider/types/web.ts";
import { CacheService } from "../../features/user/services/CacheService.ts";
import { createChatShellCapability } from "../capabilities/createChatShellCapability.ts";
import { createEmbeddingCapability } from "../capabilities/createEmbeddingCapability.ts";
import { createSubagentsCapability } from "../capabilities/createSubagentsCapability.ts";
import { createUserCapability } from "../capabilities/createUserCapability.ts";
import { createWebCapability } from "../capabilities/createWebCapability.ts";

export const ServerCapabilityService = {
	getCapabilities: async ({
		user,
		chat,
		message,
		messages,
		incognito,
		providers,
	}: {
		user: zUser;
		chat: ChatState | null | undefined;
		message: MessageState | null | undefined;
		/** What the mount is built from; a chat only adds somewhere to write. */
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}): Promise<Capabilities> => {
		const capabilities: Capabilities = {};

		if (message?.id && !incognito) {
			capabilities.user = await createUserCapability({
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
		const embeddingConfig = user.settings.embeddingConfig;
		const embed = providers.some(
			(provider) =>
				provider.name === embeddingConfig?.provider && provider.status.valid,
		);

		if (embed) {
			capabilities.embedding = await createEmbeddingCapability({ user });
		}

		if (chat?.id && message?.id) {
			capabilities.subagent = await createSubagentsCapability({
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
