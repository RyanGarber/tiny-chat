import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import { SnippetService } from "@tiny-chat/core/src/features/data/services/SnippetService.ts";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { client } from "#ui/client.ts";

export const createChatShellCapability: CapabilityFactory<
	{ chat: ChatLike },
	ShellCapability
> = async ({ chat }) => {
	return {
		getFiles: async () => {
			return await client.api.file.getFiles.query({ chat });
		},

		readFile: async ({ path }) => {
			const file = await client.api.file.getFile.query({ chat, path });
			return {
				path: file.uri,
				data: file.data,
			};
		},

		readDir: async ({ path }) => {
			const dir = await client.api.file.getDirectory.query({ chat, path });
			return dir.map((item) => ({
				path: item.uri,
				is_dir: item.isDirectory,
			}));
		},

		searchFiles: async ({ path, query, mode }) => {
			const files = await client.api.file.searchFiles.query({
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
			await client.api.file.writeFile.mutate({ chat, path, content });
			return { path, success: true };
		},

		exec: async ({ command }) => {
			return await client.api.file.exec.mutate({ chat, command });
		},
	};
};
