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
import type { zSkill } from "@tiny-chat/core/src/features/skill/types/skill.ts";
import type { Toolset } from "@tiny-chat/core/src/features/tool/types/tool.ts";
import type { Client } from "../../client.ts";
import { ClientProviderService } from "../../features/agent/services/ClientProviderService.ts";
import { createChatShellCapability } from "../capabilities/createChatShellCapability.ts";
import { createEmbeddingCapability } from "../capabilities/createEmbeddingCapability.ts";
import { createShellCapability } from "../capabilities/createShellCapability.ts";
import { createSubagentsCapability } from "../capabilities/createSubagentsCapability.ts";
import { createUserCapability } from "../capabilities/createUserCapability.ts";
import { createWebCapability } from "../capabilities/createWebCapability.ts";

export const ClientCapabilityService = {
	getCapabilities: async ({
		client,
		user,
		chat,
		message,
		messages,
		incognito,
		providers,
		skills = [],
		mcpTools = [],
	}: {
		client: Client;
		user: zUser;
		chat: ChatState | null | undefined;
		message: MessageState | null | undefined;
		/** What the mount is built from; a chat only adds somewhere to write. */
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
		skills?: zSkill[];
		mcpTools?: Toolset<any>[];
	}): Promise<Capabilities> => {
		const capabilities: Capabilities = {};

		if (message?.id && !incognito) {
			capabilities.user = await createUserCapability({ client, message });
		}

		capabilities.chatShell = await createChatShellCapability({
			client,
			chat: chat?.id,
			...AgentUtils.getMounts({ messages: messages ?? [] }),
		});

		if (client.desktop) {
			capabilities.shell = await createShellCapability({ client });
		}

		providers ??= await ClientProviderService.getProviderStates({
			client,
			user,
		});

		const embeddingConfig = user.settings.embeddingConfig;
		const embed = providers.some(
			(provider) =>
				provider.name === embeddingConfig?.provider && provider.status.valid,
		);

		if (chat?.id && message?.id) {
			capabilities.subagent = await createSubagentsCapability({
				client,
				chat,
				message,
				providers,
				skills,
				mcpTools,
			});
		}

		const web = (["search", "view"] satisfies zWebFeature[]).some(
			(feature) =>
				!!WebProviderService.getBestProvider({
					user,
					providers,
					feature,
				}),
		);
		if (web) {
			capabilities.web = await createWebCapability({ client });
		}

		if (embed) {
			capabilities.embedding = await createEmbeddingCapability({
				client,
				user,
			});
		}

		return capabilities;
	},

	/**
	 * The capabilities a message *would* have, for working out what a chat costs
	 * before anything is sent. `true` stands for "there will be one of these by
	 * then" where the real thing does not exist yet.
	 */
	getPresumedCapabilities: async ({
		client,
		user,
		chat,
		message,
		messages,
		incognito,
		providers,
	}: {
		client: Client;
		user: zUser;
		chat: ChatState | boolean | null;
		message: MessageState | boolean | null;
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}) => {
		if (typeof chat === "boolean") {
			chat = chat ? ({ id: "any" } as unknown as ChatState) : null;
		}
		if (typeof message === "boolean") {
			message = message ? ({ id: "any" } as unknown as MessageState) : null;
		}
		return await ClientCapabilityService.getCapabilities({
			client,
			user,
			chat,
			message,
			messages,
			incognito,
			providers,
		});
	},
} as const;
