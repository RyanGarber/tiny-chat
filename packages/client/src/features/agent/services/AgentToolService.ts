import type { ShellOutputHandler } from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type {
	MessageState,
	zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import type { Client } from "../../../client.ts";
import { ClientCapabilityService } from "../../capability/services/ClientCapabilityService.ts";

/**
 * Agent orchestration for tool inputs.
 */
export const AgentToolService = {
	handle: async ({
		client,
		user,
		chat,
		part,
		value,
		message,
		messages,
		onOutput,
	}: {
		client: Client;
		user: zUser;
		chat: ChatState;
		part: Extract<zDataPart, { type: "toolCall" }>;
		value: unknown;
		message: MessageState;
		messages: MessageState[];
		onOutput?: ShellOutputHandler;
	}) => {
		const capabilities = await ClientCapabilityService.getCapabilities({
			client,
			user,
			chat,
			message,
			messages,
			incognito: chat.incognito,
		});

		const toolsets = await ToolService.getTools({
			capabilities,
			incognito: chat.incognito,
		});

		const { tool } = ToolUtils.find({ toolsets, part });
		if (!tool) throw new Error("missing tool");

		return await tool.execute({
			input: part.args,
			feedback: value,
			onOutput,
			context: {
				user,
				chat,
				messages,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			},
		});
	},
} as const;
