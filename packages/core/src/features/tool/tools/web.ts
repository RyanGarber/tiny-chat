import type { WebCapability } from "#core/core/types/capability.ts";
import { createSearchWebTool } from "#core/features/tool/tools/web/search_web.ts";
import { createViewWebTool } from "#core/features/tool/tools/web/view_web.ts";
import type {
	Toolset,
	ToolsetFactory,
} from "#core/features/tool/types/tool.ts";

export const createWebToolset: ToolsetFactory<
	Toolset<{ web: WebCapability }>
> = async (options) => ({
	name: "web",
	tools: [await createSearchWebTool(options), await createViewWebTool(options)],
	...options,
});
