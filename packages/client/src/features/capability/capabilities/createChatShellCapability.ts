import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import type { FilesystemSpec } from "@tiny-chat/core/src/features/file/types/file.ts";
import type { Client } from "../../../client.ts";

export const createChatShellCapability: CapabilityFactory<
	{ client: Client } & FilesystemSpec,
	ShellCapability
> = async ({ client, ...spec }) => {
	return {
		nodes: async () => {
			return await client.api.file.getFiles.query(spec);
		},

		readFile: async ({ path }) => {
			const file = await client.api.file.getFile.query({ ...spec, path });
			return {
				path: file.uri,
				data: file.data,
			};
		},

		readDir: async ({ path }) => {
			const dir = await client.api.file.getDirectory.query({ ...spec, path });
			return dir.map((item) => ({
				path: item.uri,
				is_dir: item.isDirectory,
			}));
		},

		writeFile: async ({ path, content }) => {
			await client.api.file.writeFile.mutate({ ...spec, path, content });
			return { path, success: true };
		},

		exec: async ({ command }) => {
			return await client.api.file.exec.mutate({ ...spec, command });
		},
	};
};
