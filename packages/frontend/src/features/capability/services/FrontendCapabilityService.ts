import type { Capabilities } from "@tiny-chat/shared/src/features/capability/types/capability.ts";
import type { ChatLike } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import type { MessageLike } from "@tiny-chat/shared/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import type {
	ProviderState,
	ProviderStatus,
} from "@tiny-chat/shared/src/features/provider/types/provider.ts";
import { chatFilesystem } from "#frontend/features/capability/capabilities/chatFilesystem.ts";
import { userContext } from "#frontend/features/capability/capabilities/userContext.ts";
import { userFilesystem } from "#frontend/features/capability/capabilities/userFilesystem.ts";
import { webProvider } from "#frontend/features/capability/capabilities/webProvider.ts";
import { ProviderService } from "#frontend/features/config/services/ProviderService.ts";

export const FrontendCapabilityService = {
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
			capabilities.userContext = await userContext({ message });
		}

		if (chat) {
			capabilities.chatFilesystem = await chatFilesystem({ chat });
		}

		if (desktop) {
			capabilities.userFilesystem = await userFilesystem();
		}

		providers ??= await ProviderService.getProviderStateCache(user);
		if (
			providers?.some(
				(provider) => provider.type === "web" && provider.status.valid,
			)
		) {
			capabilities.webProvider = await webProvider();
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
		return await FrontendCapabilityService.getCapabilities({
			user,
			chat: chat as any,
			message: message as any,
			desktop,
			incognito,
			providers,
		});
	},
} as const;
