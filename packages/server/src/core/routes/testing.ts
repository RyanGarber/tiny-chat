import { z } from "zod";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { zAgentContext } from "#core/features/agent/types/agent.ts";
import { AgentUtils } from "#core/features/agent/utils/AgentUtils.ts";
import { ToolService } from "#core/features/tool/services/ToolService.ts";
import { ToolUtils } from "#core/features/tool/utils/ToolUtils.ts";
import { ServerCapabilityService } from "#server/core/services/ServerCapabilityService.ts";
import { ChatService } from "#server/features/chat/services/ChatService.ts";
import { MessageService } from "#server/features/message/services/MessageService.ts";
import { procedure, router } from "#server/index.ts";

export const testing = router({
	tool: procedure
		.input(
			z.object({
				context: zAgentContext,
				name: z.string(),
				input: z.any(),
				feedback: z.any().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!CommonUtils.isTruthy(process.env.DEV))
				throw new Error("tests not allowed in this environment");

			const { prompt } = AgentUtils.getLastPrompt({
				messages: input.context.messages,
				withText: false,
			});

			const capabilities = await ServerCapabilityService.getCapabilities({
				user: ctx.session.user,
				chat: input.context.chat?.id
					? await ChatService.getChat({
							user: ctx.session.user,
							chat: input.context.chat.id,
						})
					: null,
				message: prompt?.id
					? await MessageService.getMessage({
							user: ctx.session.user,
							message: prompt.id,
						})
					: null,
				messages: input.context.messages,
				incognito: input.context.chat?.incognito,
				temporary: input.context.chat?.temporary,
			});

			const toolsets = await ToolService.getTools({
				capabilities,
			});

			const { tool } = ToolUtils.find({ toolsets, name: input.name });

			if (!tool) throw new Error(`tool '${input.name}' not found`);

			return tool.execute({
				input: input.input,
				feedback: input.feedback,
				context: input.context,
			});
		}),
});
