import { z } from "zod";
import type { FilesystemCapability } from "../../../capability/types/capability.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	path: z.string(),
	query: z.string(),
});

const output = z.array(
	z.object({
		path: z.string(),
		snippet: z.string(),
	}),
);

export const grep_files: Tool<
	typeof input,
	void,
	typeof output,
	{ filesystem: FilesystemCapability }
> = {
	name: "grep_files",
	description: "Search for files in a directory.",

	input,
	output,

	execute: async ({ input, capabilities }) => {
		return [
			{
				type: "json",
				value: await capabilities.filesystem.searchFiles({
					path: input.path,
					query: input.query,
					mode: "grep",
				}),
			},
		];
	},
};
