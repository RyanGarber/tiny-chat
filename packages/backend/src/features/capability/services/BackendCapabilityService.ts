import type { Capabilities } from "@tiny-chat/shared/src/features/capability/types/capability.ts";
import type { ChatLike } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import { CacheService } from "../../user/services/CacheService.ts";
import { chatFilesystem } from "../capabilities/chatFilesystem.ts";
import { userContext } from "../capabilities/userContext.ts";
import { webProvider } from "../capabilities/webProvider.ts";

export const BackendCapabilityService = {
	getCapabilities: async ({
		user,
		chat,
		message,
		incognito,
	}: {
		user: zUser;
		chat: ChatLike | null | undefined;
		message: ChatLike | null | undefined;
		incognito: boolean | undefined;
	}): Promise<Capabilities> => {
		const capabilities: Capabilities = {};

		if (message && !incognito) {
			capabilities.userContext = await userContext({
				user,
				message,
			});
		}

		if (chat) {
			capabilities.chatFilesystem = await chatFilesystem({
				user,
				chat,
			});
		}

		const { providers } = await CacheService.getCache({ user });
		if (
			providers?.some(
				(provider) => provider.type === "web" && provider.status.valid,
			)
		) {
			capabilities.webProvider = await webProvider({ user });
		}

		return capabilities;
	},
} as const;
