import { ChatLike } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import { MessageLike } from "@tiny-chat/shared/src/features/data/types/message.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { ChatSearchService } from "../services/ChatSearchService.ts";
import { ChatService } from "../services/ChatService.ts";

export const chat = router({
	getChat: procedure.input(ChatLike).query(async ({ ctx, input }) => {
		return await ChatService.getChat({
			user: ctx.session.user,
			chat: input,
		});
	}),

	getChatList: procedure
		.input(
			z.object({ limit: z.number().optional(), cursor: z.cuid2().optional() }),
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

	cloneChat: procedure
		.input(
			z.object({
				chat: ChatLike,
				title: z.string(),
				upToMessage: MessageLike,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ChatService.cloneChat({
				user: ctx.session.user,
				chat: input.chat,
				title: input.title,
				upToMessage: input.upToMessage,
			});
		}),

	deleteChat: procedure.input(ChatLike).mutation(async ({ ctx, input }) => {
		return await ChatService.deleteChat({
			user: ctx.session.user,
			chat: input,
		});
	}),
});
