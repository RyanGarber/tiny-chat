import type { SubagentsCapability } from "#core/core/types/capability.ts";
import { createSpawnSubagentTool } from "#core/features/tool/tools/subagents/spawn_subagent.ts";
import type {
	Toolset,
	ToolsetFactory,
} from "#core/features/tool/types/tool.ts";

export const createSubagentsToolset: ToolsetFactory<
	Toolset<{ subagents: SubagentsCapability }>
> = async (options) => ({
	name: "subagents",
	instructions: `You can use subagents to do research, review your work, or any other task that is better specialized or parallelized.
Subagents share this chat's project, folders, tools and skills, but not the conversation: they see only your prompt, so include everything they need from it — names, paths, decisions, and what to return.
Important to note: subagents cannot get approval for shell commands or file writes, so any task requiring either must be done by yourself.`,
	tools: [await createSpawnSubagentTool(options)],
	...options,
});
