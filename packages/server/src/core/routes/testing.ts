import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { zAgentContext } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { z } from "zod";
import { ChatService } from "../../features/chat/services/ChatService.ts";
import { MessageService } from "../../features/message/services/MessageService.ts";
import { procedure, router } from "../../index.ts";
import { ServerCapabilityService } from "../services/ServerCapabilityService.ts";

export const testing = router({
	worker: procedure.mutation(async ({ ctx }) => {
		if (!CommonUtils.isTruthy(process.env.DEV))
			throw new Error("tests not allowed in this environment");

		const { WorkerService } = await import(
			"../../features/agent/services/WorkerService.ts"
		);
		await WorkerService.next({ testUserId: ctx.session.user.id });
	}),

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

			const { prompt } = AgentUtils.getLastPrompt(input.context);

			const capabilities = await ServerCapabilityService.getCapabilities({
				user: ctx.session.user,
				chat: input.context.chat
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
			});

			const toolsets = await ToolService.getTools({
				capabilities,
				incognito: input.context.chat?.incognito ?? false,
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
