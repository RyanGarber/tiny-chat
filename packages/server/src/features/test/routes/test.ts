import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { zAgentContext } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { ToolService } from "@tiny-chat/core/src/features/tool/services/ToolService.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { ServerCapabilityService } from "../../capability/services/ServerCapabilityService.ts";

export const test = router({
	worker: procedure.mutation(async ({ ctx }) => {
		if (!CommonUtils.isTruthy(process.env.DEV))
			throw new Error("tests not allowed in this environment");

		const { WorkerService } = await import(
			"../../worker/services/WorkerService.ts"
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

			const capabilities = await ServerCapabilityService.getCapabilities({
				user: ctx.session.user,
				chat: input.context.chat,
				message: input.context.messages.at(-1)?.id,
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
