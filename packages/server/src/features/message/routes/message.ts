import { zId } from "@tiny-chat/core/src/core/types/common.ts";
import { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import {
	Author,
	MessageLike,
	zConfig,
	zData,
	zMetadata,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { MessageService } from "../services/MessageService.ts";

export const message = router({
	getMessages: procedure
		.input(
			z.object({
				chat: ChatLike.nullish(),
				limit: z.number().int().positive().max(100).optional(),
				start: zId.optional(),
				branches: z.record(z.string(), z.string()).optional(),
				cursor: zId.optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			if (!input.chat) {
				return {
					messages: [],
					nextCursor: null,
					branchOptions: {} as Record<string, string[]>,
				};
			}

			return await MessageService.getMessages({
				user: ctx.session.user,
				chat: input.chat,
				limit: input.limit,
				cursor: input.cursor,
				start: input.start,
				branches: input.branches,
				omit: !!input.limit,
			});
		}),

	// TODO - zData inferring as `unknown[][]` in FilesystemService.test.ts
	//  	  could this be related the tool part issue?
	createMessage: procedure
		.input(
			z.object({
				chat: ChatLike.nullish(),
				folderId: z.string().nullish(),
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
				folderId: input.folderId,
				author: input.author,
				config: input.config,
				data: input.data,
				metadata: input.metadata,
				previous: input.previous,
				temporary: input.temporary,
				incognito: input.incognito,
			});
		}),

	editMessage: procedure
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
			return await MessageService.editMessage({
				user: ctx.session.user,
				message: input.message,
				author: input.author,
				config: input.config,
				data: input.data,
				metadata: input.metadata,
				truncate: input.truncate,
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
