import { z } from "zod";
import type { ShellCapability } from "../../../capability/types/capability.ts";
import { FileTypeUtils } from "../../../file/utils/FileTypeUtils.ts";
import { FileUtils } from "../../../file/utils/FileUtils.ts";
import { PathUtils } from "../../../file/utils/PathUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const read_file = {
	name: "read_file",
	description: "Read the contents of a file.",
	input: z.object({
		path: z.string(),
	}),
	output: z.never(),
} as const satisfies ToolDefinition;

export const createReadFileTool: ToolFactory<
	Tool<typeof read_file, { shell: ShellCapability }>
> = (options) => ({
	...read_file,
	...options,
	execute: async ({ input }) => {
		const { path } = input;
		const file = await options.capabilities.shell.readFile({
			path,
		});
		return [
			{
				type: "file",
				name: PathUtils.name(file),
				mime: await FileTypeUtils.getMime(file),
				data: FileUtils.getBase64FromBytes(file),
			},
		];
	},
});
