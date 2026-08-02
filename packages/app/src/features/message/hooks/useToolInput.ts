import { useMutation } from "@tanstack/react-query";
import { useProviders } from "@tiny-chat/client/src/features/agent/hooks/useProviders.ts";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { AgentMessageService } from "@tiny-chat/client/src/features/agent/services/AgentMessageService.ts";
import { AgentToolService } from "@tiny-chat/client/src/features/agent/services/AgentToolService.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { useSession } from "#client/src/core/hooks/useSession.ts";
import { useSkills } from "#client/src/features/agent/hooks/useSkills.ts";
import type {
	MessageState,
	zDataPart,
	zToolDataPart,
} from "#core/features/data/types/message";
import { client } from "#ui/client.ts";

export const toolCallRejection: zToolDataPart[] = [
	{ type: "json", value: "Tool call rejected by user" },
];
const toolInputMutationKey = ["toolInput"] as const;

export const useToolInput = () => {
	const { providers } = useProviders();
	const { skills } = useSkills();
	const { toolsets, mcpTools } = useTools();
	const { chat } = useChat();
	const { session } = useSession();

	const sendToolInput = useMutation({
		mutationKey: toolInputMutationKey,
		mutationFn: async ({
			seed,
			part,
			value,
			approved,
		}: {
			seed: MessageState;
			part: Extract<zDataPart, { type: "toolCall" }>;
			value?: unknown;
			approved?: boolean;
		}) => {
			console.log("[useToolInput] applying input:", part, value, approved);
			if (!session.data || !chat.data || !providers.data) return;
			const { messages } = await client.api.message.getMessages.query({
				chat: chat.data,
			});
			const message = messages.at(-1);
			if (!message) throw new Error("missing message");

			const { tool } = ToolUtils.find({ toolsets, name: part.name });
			if (!tool) throw new Error(`tool ${part.name} not found`);

			// TODO WIP - show notice if missing capability

			let result: zDataPart;
			if (tool.approval && !approved) {
				result = {
					type: "toolResult",
					id: part.id,
					name: part.name,
					error: true,
					value: toolCallRejection,
				};
			} else {
				try {
					result = {
						type: "toolResult",
						id: part.id,
						name: part.name,
						error: false,
						value: await AgentToolService.handle({
							client,
							user: session.data.user,
							chat: chat.data,
							part,
							value,
							message: seed,
							messages,
						}),
					};
				} catch (e) {
					result = {
						type: "toolResult",
						id: part.id,
						name: part.name,
						error: true,
						value: [
							{
								type: "json",
								value: e instanceof Error ? e.message : JSON.stringify(e),
							},
						],
					};
				}
			}

			await AgentMessageService.handle({
				client,
				user: session.data.user,
				message: seed,
				chat: chat.data,
				append: [result],
				mcpTools: mcpTools.data,
				providers: providers.data,
				skills,
			});
		},
	});

	return { sendToolInput };
};
