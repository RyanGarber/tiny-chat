import type { WebCapability } from "../../../core/types/capability.ts";
import type { Toolset, ToolsetFactory } from "../types/tool.ts";
import { createSearchWebTool } from "./web/search_web.ts";
import { createViewWebTool } from "./web/view_web.ts";

export const createWebToolset: ToolsetFactory<
	Toolset<{
		provider: WebCapability;
	}>
> = async (options) => ({
	name: "web",
	tools: [await createSearchWebTool(options), await createViewWebTool(options)],
	...options,
});
