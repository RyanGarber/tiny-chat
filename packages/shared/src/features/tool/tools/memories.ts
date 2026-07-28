import type { UserContextCapability } from "../../capability/types/capability.ts";
import type { ToolsetFactory } from "../types/tool.ts";
import { create_memory } from "./memories/create_memory.ts";
import { delete_memory } from "./memories/delete_memory.ts";
import { update_memory } from "./memories/update_memory.ts";

export const createMemoriesToolset: ToolsetFactory<{
	userContext: UserContextCapability;
}> = (options) => {
	return {
		name: "memories",
		tools: [create_memory, update_memory, delete_memory],
		...options,
	};
};
