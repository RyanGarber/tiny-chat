import { z } from "zod";
import type { WebProviderCapability } from "../../../capability/types/capability.ts";
import { zWebContext } from "../../../provider/types/web.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	url: z.string(),
});

const output = zWebContext;

export const view_web: Tool<
	typeof input,
	void,
	typeof output,
	{ webProvider: WebProviderCapability }
> = {
	name: "view_web",
	description: "View the contents of any URL.",

	input,
	output,

	execute: async ({ input, capabilities }) => {
		return [
			{
				type: "json",
				value: await capabilities.webProvider.view({ url: input.url }),
			},
		];
	},
};
