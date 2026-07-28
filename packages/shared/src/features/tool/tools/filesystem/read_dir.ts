import { z } from "zod";
import type { FilesystemCapability } from "../../../capability/types/capability.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	path: z.string(),
});

const output = z.array(
	z.object({
		path: z.string(),
		is_dir: z.boolean(),
	}),
);

export const read_dir: Tool<
	typeof input,
	void,
	typeof output,
	{ filesystem: FilesystemCapability }
> = {
	name: "read_dir",
	description: "Read the contents of a directory.",

	input,
	output,

	execute: async ({ input, capabilities }) => {
		return [
			{ type: "json", value: await capabilities.filesystem.readDir(input) },
		];
	},
};
