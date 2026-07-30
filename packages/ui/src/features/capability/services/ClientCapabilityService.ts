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
import { createChatShellCapability } from "#ui/features/capability/capabilities/createChatShellCapability.ts";
import { createEmbeddingCapability } from "#ui/features/capability/capabilities/createEmbeddingCapability.ts";
import { createShellCapability } from "#ui/features/capability/capabilities/createShellCapability.ts";
import { createUserCapability } from "#ui/features/capability/capabilities/createUserCapability.ts";
import { createWebCapability } from "#ui/features/capability/capabilities/createWebCapability.ts";
import { ProviderService } from "#ui/features/config/services/ProviderService.ts";

export const ClientCapabilityService = {
	getCapabilities: async ({
		user,
		chat,
		message,
		desktop,
		incognito,
		providers,
	}: {
		user: zUser;
		chat: ChatLike | null | undefined;
		message: MessageLike | null | undefined;
		desktop: boolean | undefined;
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}): Promise<Capabilities> => {
		const capabilities: Capabilities = {};

		if (message && !incognito) {
			capabilities.user = await createUserCapability({ message });
		}

		if (chat) {
			capabilities.chatShell = await createChatShellCapability({
				chat,
			});
		}

		if (desktop) {
			capabilities.shell = await createShellCapability();
		}

		providers ??= await ProviderService.getProviderStateCache(user);

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
			capabilities.web = await createWebCapability();
		}

		if (embed) {
			capabilities.embedding = await createEmbeddingCapability({ user });
		}

		return capabilities;
	},

	getPresumedCapabilities: async ({
		user,
		chat,
		message,
		desktop,
		incognito,
		providers,
	}: {
		user: zUser;
		chat: boolean;
		message: boolean;
		desktop: boolean | undefined;
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}) => {
		return await ClientCapabilityService.getCapabilities({
			user,
			chat: chat as any,
			message: message as any,
			desktop,
			incognito,
			providers,
		});
	},
} as const;
