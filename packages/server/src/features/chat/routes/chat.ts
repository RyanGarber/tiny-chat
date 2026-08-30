import { zId } from "@tiny-chat/core/src/core/types/common.ts";
import { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { ChatSearchService } from "../services/ChatSearchService.ts";
import { ChatService } from "../services/ChatService.ts";

export const chat = router({
	createFolder: procedure
		.input(z.object({}))
		.mutation(({ ctx }) =>
			ChatService.createFolder({ user: ctx.session.user }),
		),

	getChat: procedure.input(ChatLike).query(async ({ ctx, input }) => {
		return await ChatService.getChat({
			user: ctx.session.user,
			chat: input,
		});
	}),

	getChatList: procedure
		.input(
			z
				.object({ limit: z.number().optional(), cursor: zId.optional() })
				.default({}),
		)
		.query(async ({ ctx, input }) => {
			return await ChatService.getChats({
				user: ctx.session.user,
				limit: input.limit,
				cursor: input.cursor,
			});
		}),

	searchChats: procedure
		.input(
			z.object({
				searchText: z.string().optional(),
				searchEmbedding: z.array(z.number()).optional(),
				limit: z.number().optional(),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await ChatSearchService.searchChats({
				user: ctx.session.user,
				searchText: input.searchText,
				searchEmbedding: input.searchEmbedding,
				limit: input.limit,
				cursor: input.cursor,
			});
		}),

	setChatTitle: procedure
		.input(z.object({ chat: ChatLike, title: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return await ChatService.setChatTitle({
				user: ctx.session.user,
				chat: input.chat,
				title: input.title,
			});
		}),

	deleteChat: procedure.input(ChatLike).mutation(async ({ ctx, input }) => {
		return await ChatService.deleteChat({
			user: ctx.session.user,
			chat: input,
		});
	}),
});
