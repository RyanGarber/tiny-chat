import { zId } from "@tiny-chat/core/src/core/types/common.ts";
import {
	ChatLike,
	FolderLike,
} from "@tiny-chat/core/src/features/data/types/chat.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { FileService } from "../../file/services/FileService.ts";
import { ChatSearchService } from "../services/ChatSearchService.ts";
import { ChatService } from "../services/ChatService.ts";

export const chat = router({
	activate: procedure
		.input(
			z.object({ chat: z.string().nullish(), folder: z.string().nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			const folder = await ChatService.getWorkingDirectory({
				user: ctx.session.user,
				...input,
			});
			if (input.chat) FileService.activate(ctx.session.user.id, input.chat);
			return folder;
		}),

	createFolder: procedure.mutation(({ ctx }) =>
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
				searchText: z.string(),
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

	setChatFolder: procedure
		.input(z.object({ chat: ChatLike, folderId: zId.nullable() }))
		.mutation(async ({ ctx, input }) => {
			return await ChatService.setChatFolder({
				user: ctx.session.user,
				chat: input.chat,
				folderId: input.folderId,
			});
		}),

	deleteChat: procedure.input(ChatLike).mutation(async ({ ctx, input }) => {
		return await ChatService.deleteChat({
			user: ctx.session.user,
			chat: input,
		});
	}),

	setFolderTitle: procedure
		.input(
			z.object({
				folder: FolderLike,
				title: z.string(),
				cwd: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ChatService.setFolderTitle({
				user: ctx.session.user,
				folder: input.folder,
				title: input.title,
				cwd: input.cwd,
			});
		}),

	deleteFolder: procedure
		.input(z.object({ folder: FolderLike, deleteChats: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return await ChatService.deleteFolder({
				user: ctx.session.user,
				folder: input.folder,
				deleteChats: input.deleteChats,
			});
		}),
});
