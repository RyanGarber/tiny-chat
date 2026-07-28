import { z } from "zod";
import type { WebProviderCapability } from "../../../capability/types/capability.ts";
import { zWebContext } from "../../../provider/types/web.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	query: z.string(),
});

const output = z.array(zWebContext);

export const search_web: Tool<
	typeof input,
	void,
	typeof output,
	{ webProvider: WebProviderCapability }
> = {
	name: "search_web",
	description: "View the contents of any URL.",

	input,
	output,

	execute: async ({ input, capabilities }) => {
		return [
			{
				type: "json",
				value: await capabilities.webProvider.search({ query: input.query }),
			},
		];
	},
};
