import { z } from "zod";
import type { FilesystemCapability } from "../../../capability/types/capability.ts";
import { FileTypeUtils } from "../../../file/utils/FileTypeUtils.ts";
import { FileUtils } from "../../../file/utils/FileUtils.ts";
import { PathUtils } from "../../../file/utils/PathUtils.ts";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	path: z.string(),
});

const output = z.never();

export const read_file: Tool<
	typeof input,
	void,
	typeof output,
	{ filesystem: FilesystemCapability }
> = {
	name: "read_file",
	description: "Read the contents of a file.",

	input,
	output,

	execute: async ({ input, capabilities }) => {
		const { path } = input;
		const file = await capabilities.filesystem.readFile({
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
};
