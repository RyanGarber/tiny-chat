import type { WebProviderCapability } from "../../capability/types/capability.ts";
import type { ToolsetFactory } from "../types/tool.ts";
import { search_web } from "./web/search_web.ts";
import { view_web } from "./web/view_web.ts";

export const createWebToolset: ToolsetFactory<{
	webProvider: WebProviderCapability;
}> = (options) => {
	return {
		name: "web",
		tools: [search_web, view_web],
		...options,
	};
};
