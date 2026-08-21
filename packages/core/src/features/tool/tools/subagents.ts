import type { SubagentsCapability } from "../../../core/types/capability.ts";
import type { Toolset, ToolsetFactory } from "../types/tool.ts";
import { createSpawnSubagentTool } from "./subagents/spawn_subagent.ts";

export const createSubagentsToolset: ToolsetFactory<
	Toolset<{ subagent: SubagentsCapability }>
> = async (options) => ({
	name: "subagents",
	tools: [await createSpawnSubagentTool(options)],
	...options,
});
