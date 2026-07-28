import { z } from "zod";
import type { FilesystemCapability } from "../../../capability/types/capability.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	command: z.string(),
});

const output = z.object({
	code: z.number().optional(),
	stdout: z.string(),
	stderr: z.string(),
});

export const shell_exec: Tool<
	typeof input,
	void,
	typeof output,
	{ filesystem: FilesystemCapability }
> = {
	name: "shell_exec",
	description: "Execute a shell command.",
	approval: true,

	input,
	output,

	execute: async ({ input, capabilities }) => {
		return [
			{
				type: "json",
				value: await capabilities.filesystem.exec({ command: input.command }),
			},
		];
	},
};
