import { useMutation } from "@tanstack/react-query";
import type {
	MessageState,
	zDataBasicPart,
	zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { ToolCallUtils } from "@tiny-chat/core/src/features/tool/utils/ToolCallUtils.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { useSession } from "../../../core/hooks/useSession.ts";
import { useProviders } from "../../agent/hooks/useProviders.ts";
import { useSkills } from "../../agent/hooks/useSkills.ts";
import { useTools } from "../../agent/hooks/useTools.ts";
import { AgentMessageService } from "../../agent/services/AgentMessageService.ts";
import { AgentToolService } from "../../agent/services/AgentToolService.ts";
import { useChat } from "./useChat.ts";

export const toolCallRejection = ToolCallUtils.rejection;
const sendToolInputMutationKey = ["useToolInput", "sendToolInput"] as const;

export const useToolInput = () => {
	const client = useContext(ClientProvider);

	const { providers } = useProviders();
	const { skills } = useSkills();
	const { toolsets, mcpTools } = useTools();
	const { chat } = useChat();
	const { session } = useSession();

	const sendToolInput = useMutation({
		mutationKey: sendToolInputMutationKey,
		mutationFn: async ({
			seed,
			part,
			value,
			approved,
			append = [],
		}: {
			seed: MessageState;
			part: Extract<zDataPart, { type: "toolCall" }>;
			value?: unknown;
			approved?: boolean;
			append?: zDataBasicPart[];
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
					append,
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
						append,
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
						append,
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
