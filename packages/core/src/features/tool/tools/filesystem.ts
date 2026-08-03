import type { ShellCapability } from "../../capability/types/capability.ts";
import type { Toolset, ToolsetFactory } from "../types/tool.ts";
import { createEditFileTool } from "./shell/edit_file.ts";
import { createGrepFilesTool } from "./shell/grep_files.ts";
import { createReadDirTool } from "./shell/read_dir.ts";
import { createReadFileTool } from "./shell/read_file.ts";
import { createSearchFilesTool } from "./shell/search_files.ts";
import { createShellExecTool } from "./shell/shell_exec.ts";
import { createWriteFileTool } from "./shell/write_file.ts";

export const createShellToolset: ToolsetFactory<
	Toolset<{
		shell: ShellCapability;
	}>
> = async (options) => ({
	name: "shell",
	tools: [
		await createReadFileTool(options),
		await createReadDirTool(options),
		await createSearchFilesTool(options),
		await createGrepFilesTool(options),
		await createWriteFileTool({ ...options, approval: true }),
		await createEditFileTool({ ...options, approval: true }),
		await createShellExecTool({ ...options, approval: true }),
	],
	...options,
});
