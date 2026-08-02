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
		incognito,
		providers,
	}: {
		client: Client;
		user: zUser;
		chat: ChatLike | null | undefined;
		message: MessageLike | null | undefined;
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}): Promise<Capabilities> => {
		const capabilities: Capabilities = {};

		if (message && !incognito) {
			capabilities.user = await createUserCapability({ client, message });
		}

		if (chat) {
			capabilities.chatShell = await createChatShellCapability({
				client,
				chat,
			});
		}

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

	getPresumedCapabilities: async ({
		client,
		user,
		chat,
		message,
		incognito,
		providers,
	}: {
		client: Client;
		user: zUser;
		chat: boolean;
		message: boolean;
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}) => {
		return await ClientCapabilityService.getCapabilities({
			client,
			user,
			chat: chat as any,
			message: message as any,
			incognito,
			providers,
		});
	},
} as const;
