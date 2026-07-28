import type { ChatState } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import type {
	MessageState,
	zDataPart,
} from "@tiny-chat/shared/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import type { Tool } from "@tiny-chat/shared/src/features/tool/types/tool.ts";
import { FrontendCapabilityService } from "#frontend/features/capability/services/FrontendCapabilityService.ts";
import { isTauriDesktop } from "#frontend/utils/api.ts";

export const ToolInputHandlerService = {
	handle: async ({
		user,
		chat,
		tool,
		part,
		value,
		message,
		messages,
	}: {
		user: zUser;
		chat: ChatState;
		tool: Tool<any, any, any, any>;
		part: Extract<zDataPart, { type: "toolCall" }>;
		value: unknown;
		message: MessageState;
		messages: MessageState[];
	}) => {
		const capabilities = await FrontendCapabilityService.getCapabilities({
			user,
			chat,
			message,
			desktop: await isTauriDesktop(),
			incognito: chat.incognito,
		});
		return await tool.execute({
			input: part.args,
			feedback: value,
			context: {
				user,
				chat,
				messages: messages,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				supportsUserInput: true,
			},
			capabilities,
		});
	},
} as const;
