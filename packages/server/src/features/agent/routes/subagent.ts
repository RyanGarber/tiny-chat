import { z } from "zod";
import { MessageLike } from "#core/features/data/types/message.ts";
import { zData, zMetadata } from "#core/features/data/types/part.ts";
import { SubagentService } from "#server/features/agent/services/SubagentService.ts";
import { procedure, router } from "#server/index.ts";

export const subagent = router({
	getSubagents: procedure
		.input(z.object({ messages: z.array(z.string()) }))
		.query(async ({ ctx, input }) => {
			return await SubagentService.getSubagents({
				user: ctx.session.user,
				messages: input.messages,
			});
		}),

	saveSubagent: procedure
		.input(
			z.object({
				part: z.string(),
				message: MessageLike,
				data: zData,
				metadata: zMetadata,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await SubagentService.saveSubagent({
				user: ctx.session.user,
				part: input.part,
				message: input.message,
				data: input.data,
				metadata: input.metadata,
			});
		}),
});
