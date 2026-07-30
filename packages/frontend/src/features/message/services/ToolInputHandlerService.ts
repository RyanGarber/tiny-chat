import type { ChatState } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import type {
	MessageState,
	zDataPart,
} from "@tiny-chat/shared/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import { ToolService } from "@tiny-chat/shared/src/features/tool/services/ToolService.ts";
import { ToolUtils } from "@tiny-chat/shared/src/features/tool/utils/ToolUtils.ts";
import { FrontendCapabilityService } from "#frontend/features/capability/services/FrontendCapabilityService.ts";
import { isTauriDesktop } from "#frontend/utils/api.ts";

export const ToolInputHandlerService = {
	handle: async ({
		user,
		chat,
		part,
		value,
		message,
		messages,
	}: {
		user: zUser;
		chat: ChatState;
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

		const toolsets = await ToolService.getTools({
			capabilities,
			incognito: chat.incognito,
		});

		const { tool } = ToolUtils.find({ toolsets, name: part.name });
		if (!tool) throw new Error("missing tool");

		return await tool.execute({
			input: part.args,
			feedback: value,
			context: {
				user,
				chat,
				messages,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			},
		});
	},
} as const;
