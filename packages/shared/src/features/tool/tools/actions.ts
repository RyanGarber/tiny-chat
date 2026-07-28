import type { UserContextCapability } from "../../capability/types/capability.ts";
import type { ToolsetFactory } from "../types/tool.ts";
import { create_action } from "./actions/create_action.ts";
import { delete_action } from "./actions/delete_action.ts";
import { list_actions } from "./actions/list_actions.ts";
import { update_action } from "./actions/update_action.ts";

export const createActionsToolset: ToolsetFactory<{
	userContext: UserContextCapability;
}> = (options) => {
	return {
		name: "actions",
		tools: [list_actions, create_action, update_action, delete_action],
		...options,
	};
};
