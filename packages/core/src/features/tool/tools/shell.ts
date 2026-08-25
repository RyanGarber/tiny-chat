import type { Capabilities } from "../../../core/types/capability.ts";
import type { Toolset, ToolsetFactory } from "../types/tool.ts";
import { createEditFileTool } from "./shell/edit_file.ts";
import { createFindFilesTool } from "./shell/find_files.ts";
import { createGrepFilesTool } from "./shell/grep_files.ts";
import { createReadDirTool } from "./shell/read_dir.ts";
import { createReadFileTool } from "./shell/read_file.ts";
import { createSearchFilesTool } from "./shell/search_files.ts";
import { createShellExecTool } from "./shell/shell_exec.ts";
import { createWriteFileTool } from "./shell/write_file.ts";

export const createShellToolset: ToolsetFactory<
	Toolset<Pick<Capabilities, "shell" | "chatShell">>
> = async (options) => ({
	name: "shell",
	tools: [
		await createReadFileTool(options),
		await createReadDirTool(options),
		await createFindFilesTool(options),
		await createSearchFilesTool(options),
		await createGrepFilesTool(options),
		await createWriteFileTool(options),
		await createEditFileTool(options),
		await createShellExecTool(options),
	],
	...options,
});
