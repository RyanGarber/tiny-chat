import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { ChatLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { FileService } from "../../file/services/FileService.ts";

export const createChatShellCapability: CapabilityFactory<
	{
		user: zUser;
		chat: ChatLike;
	},
	ShellCapability
> = async ({ user, chat }) => {
	return {
		nodes: async () => {
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

		writeFile: async ({ path, content }) => {
			await FileService.writeFile({ user, chat, path, content });
			return { path, success: true };
		},

		exec: async ({ command }) => {
			return await FileService.exec({ user, chat, command });
		},
	};
};
