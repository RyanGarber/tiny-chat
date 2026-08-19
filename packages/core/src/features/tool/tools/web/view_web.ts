import { z } from "zod";
import type { WebCapability } from "../../../../core/types/capability.ts";
import { zWebContext } from "../../../provider/types/web.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const view_web = {
	name: "view_web",
	description: "View the contents of any URL.",
	input: z.object({
		url: z.string(),
	}),
	output: zWebContext,
} as const satisfies ToolDefinition;

export const createViewWebTool: ToolFactory<
	Tool<typeof view_web, { provider: WebCapability }>
> = (options) => ({
	...view_web,
	...options,
	execute: async ({ input }) => {
		return [
			{
				type: "json",
				value: await options.capabilities.provider.view({ url: input.url }),
			},
		];
	},
});
