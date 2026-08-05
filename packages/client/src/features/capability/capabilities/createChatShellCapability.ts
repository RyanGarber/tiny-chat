import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { Client } from "../../../client.ts";

export const createChatShellCapability: CapabilityFactory<
	{ client: Client; chat: ChatLike },
	ShellCapability
> = async ({ client, chat }) => {
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

		writeFile: async ({ path, content }) => {
			await client.api.file.writeFile.mutate({ chat, path, content });
			return { path, success: true };
		},

		exec: async ({ command }) => {
			return await client.api.file.exec.mutate({ chat, command });
		},
	};
};
