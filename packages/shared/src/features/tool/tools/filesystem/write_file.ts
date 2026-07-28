import { z } from "zod";
import type { FilesystemCapability } from "../../../capability/types/capability.ts";
import type { Tool } from "../../types/tool.ts";

// TODO - replace specific line numbers
const input = z.object({
	path: z.string(),
	content: z.string(),
});

const output = z.object({ path: z.string(), success: true });

export const write_file: Tool<
	typeof input,
	void,
	typeof output,
	{ filesystem: FilesystemCapability }
> = {
	name: "write_file",
	description: "Write content to a file.",
	approval: true,

	input,
	output,

	execute: async ({ input, capabilities }) => {
		return [
			{
				type: "json",
				value: await capabilities.filesystem.writeFile({
					path: input.path,
					content: input.content,
				}),
			},
		];
	},
};
