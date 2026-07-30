import type {
	CapabilityFactory,
	ShellCapability,
} from "@tiny-chat/shared/src/features/capability/types/capability.ts";
import { SnippetService } from "@tiny-chat/shared/src/features/data/services/SnippetService.ts";
import { FileUtils } from "@tiny-chat/shared/src/features/file/utils/FileUtils.ts";
import { invoke } from "#frontend/utils/api.ts";

export const createShellCapability: CapabilityFactory<
	void,
	ShellCapability
> = async () => {
	return {
		readFile: async ({ path }) => {
			const file = await invoke<{ path: string; data: string }>("read_file", {
				path,
			});
			return {
				path: file.path,
				data: FileUtils.getBufferFromBytes(file),
			};
		},

		readDir: async ({ path }) => {
			const dir = await invoke<{ path: string; is_dir: boolean }[]>(
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
			await invoke("write_file", { path, content });
			return { path, success: true };
		},

		searchFiles: async ({ path, query, mode }) => {
			const files = await invoke<{ path: string; data: string }[]>(
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
			return invoke<{ code?: number; stdout: string; stderr: string }>(
				"shell_exec",
				{ command },
			);
		},
	};
};
