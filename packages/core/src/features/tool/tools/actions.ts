import type { ActionsCapability } from "#core/core/types/capability.ts";
import { createCreateActionTool } from "#core/features/tool/tools/actions/create_action.ts";
import { createDeleteActionTool } from "#core/features/tool/tools/actions/delete_action.ts";
import { createListActionsTool } from "#core/features/tool/tools/actions/list_actions.ts";
import { createUpdateActionTool } from "#core/features/tool/tools/actions/update_action.ts";
import type {
	Toolset,
	ToolsetFactory,
} from "#core/features/tool/types/tool.ts";

export const createActionsToolset: ToolsetFactory<
	Toolset<{
		actions: ActionsCapability;
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
