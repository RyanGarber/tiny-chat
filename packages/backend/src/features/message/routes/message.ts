import { ChatLike } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import {
	Author,
	MessageLike,
	zConfig,
	zData,
	zMetadata,
} from "@tiny-chat/shared/src/features/data/types/message.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { MessageService } from "../services/MessageService.ts";

export const message = router({
	getMessages: procedure
		.input(
			z.object({
				chat: ChatLike.nullish(),
				limit: z.number().optional(),
				cursor: z.cuid2().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			if (!input.chat) {
				return { messages: [], nextCursor: null };
			}

			return await MessageService.getMessages({
				user: ctx.session.user,
				chat: input.chat,
				limit: input.limit,
				cursor: input.cursor,
			});
		}),

	createMessage: procedure
		.input(
			z.object({
				chat: ChatLike.nullish(),
				author: z.enum(Author),
				config: zConfig,
				data: zData,
				metadata: zMetadata,
				previous: MessageLike.nullish(),
				temporary: z.boolean().optional(),
				incognito: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await MessageService.createMessage({
				user: ctx.session.user,
				chat: input.chat,
				author: input.author,
				config: input.config,
				data: input.data,
				metadata: input.metadata,
				previous: input.previous,
				temporary: input.temporary,
				incognito: input.incognito,
			});
		}),

	updateMessage: procedure
		.input(
			z.object({
				message: MessageLike,
				author: z.enum(Author),
				config: zConfig,
				data: zData,
				metadata: zMetadata,
				truncate: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await MessageService.updateMessage({
				user: ctx.session.user,
				message: input.message,
				author: input.author,
				config: input.config,
				data: input.data,
				metadata: input.metadata,
				truncate: input.truncate,
			});
		}),

	deleteMessage: procedure
		.input(MessageLike)
		.mutation(async ({ ctx, input }) => {
			return await MessageService.deleteMessage({
				user: ctx.session.user,
				message: input,
			});
		}),
});
