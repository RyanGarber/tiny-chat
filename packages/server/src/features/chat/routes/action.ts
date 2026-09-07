import { zId } from "@tiny-chat/core/src/core/types/common.ts";
import { MessageLike } from "@tiny-chat/core/src/features/data/types/message.ts";
import { zData } from "@tiny-chat/core/src/features/data/types/part.ts";
import z from "zod";
import { procedure, router } from "../../../index.ts";
import { ActionService } from "../services/ActionService.ts";

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
