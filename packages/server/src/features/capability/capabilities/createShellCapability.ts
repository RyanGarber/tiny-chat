import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import { SnippetService } from "@tiny-chat/core/src/features/data/services/SnippetService.ts";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { FileService } from "../../chat/services/FileService.ts";

export const createShellCapability: CapabilityFactory<
	{
		user: zUser;
		chat: ChatLike;
	},
	ShellCapability
> = async ({ user, chat }) => {
	return {
		getFiles: async () => {
			return await FileService.getFiles({ user, chat });
		},

		readFile: async ({ path }) => {
			const file = await FileService.getFile({ user, chat, path });
			return {
				path: file.uri,
				data: file.data,
			};
		},

		readDir: async ({ path }) => {
			const dir = await FileService.getDirectory({ user, chat, path });
			return dir.map((item) => ({
				path: item.uri,
				is_dir: item.isDirectory,
			}));
		},

		searchFiles: async ({ path, query, mode }) => {
			const files = await FileService.searchFiles({
				user,
				chat,
				path,
				mode,
				searchText: query,
				limit: 10,
			});
			return files.map((file) => ({
				path: file.uri,
				snippet: SnippetService.getSnippet({
					text: FileUtils.getTextFromBytes(file) ?? "",
					query,
					baseWindow: 500,
				}),
			}));
		},

		writeFile: async ({ path, content }) => {
			await FileService.writeFile({ user, chat, path, content });
			return { path, success: true };
		},

		exec: async ({ command }) => {
			return await FileService.exec({ user, chat, command });
		},
	};
};
