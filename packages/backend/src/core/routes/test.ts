import { zAgentContext } from "@tiny-chat/shared/src/features/agent/types/agent.ts";
import { ToolService } from "@tiny-chat/shared/src/features/tool/services/ToolService.ts";
import { ToolUtils } from "@tiny-chat/shared/src/features/tool/utils/ToolUtils.ts";
import { z } from "zod";
import { BackendCapabilityService } from "../../features/capability/services/BackendCapabilityService.ts";
import { procedure, router } from "../../index.ts";

export const test = router({
	worker: procedure.mutation(async ({ ctx }) => {
		if (!process.env.DEV)
			throw new Error("tests not allowed in this environment");

		const { WorkerService } = await import(
			"../../features/worker/services/WorkerService.ts"
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
			if (!process.env.DEV)
				throw new Error("tests not allowed in this environment");

			const capabilities = await BackendCapabilityService.getCapabilities({
				user: ctx.session.user,
				chat: input.context.chat,
				message: input.context.messages.at(-1)?.id,
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
