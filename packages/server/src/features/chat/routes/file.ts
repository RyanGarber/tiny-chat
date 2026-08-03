import { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type {
	FileNode,
	FileState,
} from "@tiny-chat/core/src/features/file/types/file.ts";
import { PathLike } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { FileService } from "../services/FileService.ts";

export const file = router({
	getFile: procedure
		.input(
			z.object({
				chat: ChatLike,
				path: PathLike,
			}),
		)
		.output(z.custom<FileState>())
		.query(async ({ ctx, input }) => {
			return await FileService.getFile({
				user: ctx.session.user,
				chat: input.chat,
				path: input.path,
			});
		}),

	getFiles: procedure
		.input(z.object({ chat: ChatLike }))
		.output(z.custom<FileNode[]>())
		.query(async ({ ctx, input }) => {
			return await FileService.getFiles({
				user: ctx.session.user,
				chat: input.chat,
			});
		}),

	getDirectory: procedure
		.input(z.object({ chat: ChatLike, path: PathLike }))
		.query(async ({ ctx, input }) => {
			return await FileService.getDirectory({
				user: ctx.session.user,
				chat: input.chat,
				path: input.path,
			});
		}),

	searchFiles: procedure
		.input(
			z.object({
				chat: ChatLike,
				path: PathLike.optional(),
				searchText: z.string(),
				searchEmbedding: z.array(z.number()).optional(),
				mode: z.enum(["standard", "grep"]).optional(),
				limit: z.number().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await FileService.searchFiles({
				user: ctx.session.user,
				chat: input.chat,
				path: input.path,
				searchText: input.searchText,
				searchEmbedding: input.searchEmbedding,
				mode: input.mode,
				limit: input.limit,
			});
		}),

	writeFile: procedure
		.input(z.object({ chat: ChatLike, path: PathLike, content: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await FileService.writeFile({
				user: ctx.session.user,
				chat: input.chat,
				path: input.path,
				content: input.content,
			});
		}),

	editFile: procedure
		.input(
			z.object({
				chat: ChatLike,
				path: PathLike,
				old_string: z.string(),
				new_string: z.string(),
				replace_all: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return await FileService.editFile({
				user: ctx.session.user,
				chat: input.chat,
				path: input.path,
				old_string: input.old_string,
				new_string: input.new_string,
				replace_all: input.replace_all,
			});
		}),

	exec: procedure
		.input(z.object({ chat: ChatLike, command: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return FileService.exec({
				user: ctx.session.user,
				chat: input.chat,
				command: input.command,
			});
		}),
});
