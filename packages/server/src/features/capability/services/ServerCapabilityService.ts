import type { Capabilities } from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { WebProviderService } from "@tiny-chat/core/src/features/provider/services/WebProviderService.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/core/src/features/provider/types/provider.ts";
import type { zWebFeature } from "@tiny-chat/core/src/features/provider/types/web.ts";
import { CacheService } from "../../user/services/CacheService.ts";
import { createEmbeddingCapability } from "../capabilities/createEmbeddingCapability.ts";
import { createShellCapability } from "../capabilities/createShellCapability.ts";
import { createUserCapability } from "../capabilities/createUserCapability.ts";
import { createWebCapability } from "../capabilities/createWebCapability.ts";

export const ServerCapabilityService = {
	getCapabilities: async ({
		user,
		chat,
		message,
		incognito,
		providers,
	}: {
		user: zUser;
		chat: ChatLike | null | undefined;
		message: ChatLike | null | undefined;
		incognito: boolean | undefined;
		providers?: ProviderState<ProviderStatus>[];
	}): Promise<Capabilities> => {
		const capabilities: Capabilities = {};

		if (message && !incognito) {
			capabilities.user = await createUserCapability({
				user,
				message,
			});
		}

		if (chat) {
			capabilities.chatShell = await createShellCapability({
				user,
				chat,
			});
		}

		providers ??= (await CacheService.getCache({ user })).providers;
		const embeddingConfig = user.settings.embeddingConfig;
		const embed = providers.some(
			(provider) =>
				provider.name === embeddingConfig?.provider && provider.status.valid,
		);

		if (embed) {
			capabilities.embedding = await createEmbeddingCapability({ user });
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
