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
	instructions: [
		options.instructions,
		"Look before you change anything: read a file before editing it, check before overwriting or deleting, and batch independent reads and searches into one turn. When working on a coding task, read the relevant code and any project guidance first and follow the conventions you find. Make the change, add or update tests where the project has them, then run its own lint, type-check/build and test commands. Fix failures your change caused and rerun; report anything you couldn't run or that still fails.",
		"On multi-step work, give a short update at natural milestones (what you found, what you're changing, what's left) instead of working silently through many calls or narrating each one, and end with a brief summary of what changed and how you verified it.",
	]
		.filter(Boolean)
		.join("\n\n"),
});
