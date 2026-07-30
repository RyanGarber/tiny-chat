import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/core/src/features/capability/types/capability.ts";
import { SnippetService } from "@tiny-chat/core/src/features/data/services/SnippetService.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";

export const createShellCapability: CapabilityFactory<
	void,
	ShellCapability
> = async () => {
	return {
		readFile: async ({ path }) => {
			const file = await TauriUtils.invoke<{ path: string; data: string }>(
				"read_file",
				{
					path,
				},
			);
			return {
				path: file.path,
				data: FileUtils.getBufferFromBytes(file),
			};
		},

		readDir: async ({ path }) => {
			const dir = await TauriUtils.invoke<{ path: string; is_dir: boolean }[]>(
				"read_dir",
				{
					path,
				},
			);
			return dir.map((item) => ({
				path: item.path,
				is_dir: item.is_dir,
			}));
		},

		writeFile: async ({ path, content }) => {
			await TauriUtils.invoke("write_file", { path, content });
			return { path, success: true };
		},

		searchFiles: async ({ path, query, mode }) => {
			const files = await TauriUtils.invoke<{ path: string; data: string }[]>(
				"search_files",
				{
					path,
					pattern: query,
					mode,
					max_results: 10,
				},
			);
			return files.map((file) => ({
				path: file.path,
				snippet: SnippetService.getSnippet({
					text: FileUtils.getTextFromBytes(file) ?? "",
					query,
					baseWindow: 500,
				}),
			}));
		},

		exec: ({ command }) => {
			return TauriUtils.invoke<{
				code?: number;
				stdout: string;
				stderr: string;
			}>("shell_exec", { command });
		},
	};
};
