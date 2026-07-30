import type { UserCapability } from "../../capability/types/capability.ts";
import type { Toolset, ToolsetFactory } from "../types/tool.ts";
import { createCreateActionTool } from "./actions/create_action.ts";
import { createDeleteActionTool } from "./actions/delete_action.ts";
import { createListActionsTool } from "./actions/list_actions.ts";
import { createUpdateActionTool } from "./actions/update_action.ts";

export const createActionsToolset: ToolsetFactory<
	Toolset<{
		user: UserCapability;
	}>
> = async (options) => ({
	name: "actions",
	tools: [
		await createListActionsTool(options),
		await createCreateActionTool(options),
		await createUpdateActionTool(options),
		await createDeleteActionTool(options),
	],
	...options,
});
