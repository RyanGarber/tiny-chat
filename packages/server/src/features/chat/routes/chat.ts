import { zId } from "@tiny-chat/core/core/types/common.ts";
import {
	ChatLike,
	ProjectLike,
} from "@tiny-chat/core/features/data/types/chat.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { FileService } from "../../file/services/FileService.ts";
import { ChatSearchService } from "../services/ChatSearchService.ts";
import { ChatService } from "../services/ChatService.ts";

export const chat = router({
	activate: procedure
		.input(
			z.object({ chat: z.string().nullish(), project: z.string().nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			const project = await ChatService.getWorkingDirectory({
				user: ctx.session.user,
				chat: input.chat,
				project: input.project,
			});
			if (input.chat) FileService.activate(ctx.session.user.id, input.chat);
			return project;
		}),

	createProject: procedure.mutation(({ ctx }) =>
		ChatService.createProject({ user: ctx.session.user }),
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

	setChatProject: procedure
		.input(z.object({ chat: ChatLike, projectId: zId.nullable() }))
		.mutation(async ({ ctx, input }) => {
			return await ChatService.setChatProject({
				user: ctx.session.user,
				chat: input.chat,
				projectId: input.projectId,
			});
		}),

	deleteChat: procedure.input(ChatLike).mutation(async ({ ctx, input }) => {
		return await ChatService.deleteChat({
			user: ctx.session.user,
			chat: input,
		});
	}),

	updateProject: procedure
		.input(
			z.object({
				project: ProjectLike,
				title: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await ChatService.updateProject({
				user: ctx.session.user,
				project: input.project,
				title: input.title,
			});
		}),

	deleteProject: procedure
		.input(z.object({ project: ProjectLike, deleteChats: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return await ChatService.deleteProject({
				user: ctx.session.user,
				project: input.project,
				deleteChats: input.deleteChats,
			});
		}),
});
