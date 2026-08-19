import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/core/src/core/types/capability.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type { FilesystemSpec } from "@tiny-chat/core/src/features/file/types/file.ts";
import { FileService } from "../../features/file/services/FileService.ts";

export const createChatShellCapability: CapabilityFactory<
	{ user: zUser } & FilesystemSpec,
	ShellCapability
> = async ({ user, ...spec }) => {
	return {
		nodes: async () => {
			return await FileService.getFiles({ user, ...spec });
		},

		readFile: async ({ path }) => {
			const file = await FileService.getFile({ user, ...spec, path });
			return {
				path: file.uri,
				data: file.data,
			};
		},

		readDir: async ({ path }) => {
			const dir = await FileService.getDirectory({ user, ...spec, path });
			return dir.map((item) => ({
				path: item.uri,
				is_dir: item.isDirectory,
			}));
		},

		writeFile: async ({ path, content }) => {
			await FileService.writeFile({ user, ...spec, path, content });
			return { path, success: true };
		},

		exec: async ({ command }) => {
			return await FileService.exec({ user, ...spec, command });
		},
	};
};
