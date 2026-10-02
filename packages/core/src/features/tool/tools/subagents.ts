import type { SubagentsCapability } from "../../../core/types/capability.ts";
import type { Toolset, ToolsetFactory } from "../types/tool.ts";
import { createSpawnSubagentTool } from "./subagents/spawn_subagent.ts";

export const createSubagentsToolset: ToolsetFactory<
	Toolset<{ subagents: SubagentsCapability }>
> = async (options) => ({
	name: "subagents",
	instructions: `You can use subagents to do research, review your work, or any other task that is better specialized or parallelized.
Important to note: subagents cannot get approval for shell commands or file writes, so any task requiring either must be done by yourself.`,
	tools: [await createSpawnSubagentTool(options)],
	...options,
});
