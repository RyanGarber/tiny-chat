import z from "zod";
import { zId } from "#core/core/types/common.ts";
import { MessageLike } from "#core/features/data/types/message.ts";
import { zData } from "#core/features/data/types/part.ts";
import { ActionService } from "#server/features/chat/services/ActionService.ts";
import { procedure, router } from "#server/index.ts";

export const action = router({
	getActions: procedure.query(async ({ ctx }) => {
		return ActionService.getActions({ user: ctx.session.user });
	}),

	createAction: procedure
		.input(
			z.object({
				message: MessageLike,
				schedule: z.string(),
				timezone: z.string(),
				data: zData,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ActionService.createAction({
				user: ctx.session.user,
				message: input.message,
				schedule: input.schedule,
				timezone: input.timezone,
				data: input.data,
			});
		}),

	updateAction: procedure
		.input(
			z.object({
				id: zId,
				message: MessageLike,
				schedule: z.string(),
				timezone: z.string(),
				data: zData,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ActionService.updateAction({
				id: input.id,
				user: ctx.session.user,
				message: input.message,
				schedule: input.schedule,
				timezone: input.timezone,
				data: input.data,
			});
		}),

	deleteAction: procedure
		.input(
			z.object({
				id: zId,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ActionService.deleteAction({
				id: input.id,
				user: ctx.session.user,
			});
		}),
});
