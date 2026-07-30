import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/shared/src/features/capability/types/capability.ts";
import { SnippetService } from "@tiny-chat/shared/src/features/data/services/SnippetService.ts";
import type { ChatLike } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import { FileUtils } from "@tiny-chat/shared/src/features/file/utils/FileUtils.ts";
import { trpc } from "#frontend/utils/api.ts";

export const createChatShellCapability: CapabilityFactory<
	{ chat: ChatLike },
	ShellCapability
> = async ({ chat }) => {
	return {
		getFiles: async () => {
			return await trpc.file.getFiles.query({ chat });
		},

		readFile: async ({ path }) => {
			const file = await trpc.file.getFile.query({ chat, path });
			return {
				path: file.uri,
				data: file.data,
			};
		},

		readDir: async ({ path }) => {
			const dir = await trpc.file.getDirectory.query({ chat, path });
			return dir.map((item) => ({
				path: item.uri,
				is_dir: item.isDirectory,
			}));
		},

		searchFiles: async ({ path, query, mode }) => {
			const files = await trpc.file.searchFiles.query({
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
			await trpc.file.writeFile.mutate({ chat, path, content });
			return { path, success: true };
		},

		exec: async ({ command }) => {
			return await trpc.file.exec.mutate({ chat, command });
		},
	};
};
