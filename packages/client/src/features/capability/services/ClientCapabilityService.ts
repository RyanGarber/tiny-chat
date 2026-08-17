import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import type { Capabilities } from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { WebProviderService } from "@tiny-chat/core/src/features/provider/services/WebProviderService.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { zWebFeature } from "@tiny-chat/core/src/features/provider/types/web.ts";
import type { Client } from "../../../client.ts";
import { ProviderService } from "../../agent/services/ProviderService.ts";
import { createChatShellCapability } from "../capabilities/createChatShellCapability.ts";
import { createEmbeddingCapability } from "../capabilities/createEmbeddingCapability.ts";
import { createShellCapability } from "../capabilities/createShellCapability.ts";
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
	}: {
		client: Client;
		user: zUser;
		chat: ChatLike | null | undefined;
		message: MessageLike | null | undefined;
		/** What the mount is built from; a chat only adds somewhere to write. */
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}): Promise<Capabilities> => {
		if (typeof chat === "string") chat = { id: chat };
		if (typeof message === "string") message = { id: message };

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

		providers ??= await ProviderService.getProviderStates({ client, user });

		const embeddingConfig = user.settings.embeddingConfig;
		const embed = providers.some(
			(provider) =>
				provider.name === embeddingConfig?.provider && provider.status.valid,
		);

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
		chat: ChatLike | boolean | null;
		message: MessageLike | boolean | null;
		messages?: zAgentMessage[];
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}) => {
		if (typeof chat === "boolean") chat = chat ? { id: "any" } : null;
		if (typeof message === "boolean") message = message ? { id: "any" } : null;
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
