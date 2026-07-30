import { useMutation } from "@tanstack/react-query";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import type {
	MessageState,
	zDataPart,
	zToolDataPart,
} from "#core/features/data/types/message";
import { client } from "#ui/client.ts";
import { useChat } from "#ui/features/chat/hooks/useChat.ts";
import { useProviders } from "#ui/features/config/hooks/useProviders.ts";
import { useTools } from "#ui/features/config/hooks/useTools.ts";
import { useSkills } from "#ui/features/file/hooks/useSkills.ts";
import { MessageHandlerService } from "../services/MessageHandlerService.ts";
import { ToolInputHandlerService } from "../services/ToolInputHandlerService.ts";

export const toolCallRejection: zToolDataPart[] = [
	{ type: "json", value: "Tool call rejected by user" },
];
const toolInputMutationKey = ["toolInput"] as const;

export const useToolInput = () => {
	const { providers } = useProviders();
	const { skills } = useSkills();
	const { toolsets, mcpTools } = useTools();
	const { chat } = useChat();
	const session = client.auth.useSession();

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
						value: await ToolInputHandlerService.handle({
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

			await MessageHandlerService.handle({
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
