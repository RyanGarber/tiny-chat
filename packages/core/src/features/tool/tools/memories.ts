import type { UserCapability } from "../../capability/types/capability.ts";
import type { Toolset, ToolsetFactory } from "../types/tool.ts";
import { createCreateMemoryTool } from "./memories/create_memory.ts";
import { createDeleteMemoryTool } from "./memories/delete_memory.ts";
import { createUpdateMemoryTool } from "./memories/update_memory.ts";

export const createMemoriesToolset: ToolsetFactory<
	Toolset<{
		user: UserCapability;
	}>
> = async (options) => ({
	name: "memories",
	tools: [
		await createCreateMemoryTool(options),
		await createUpdateMemoryTool(options),
		await createDeleteMemoryTool(options),
	],
	...options,
});
