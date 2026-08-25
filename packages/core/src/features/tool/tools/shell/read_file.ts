import { z } from "zod";
import type { Capabilities } from "../../../../core/types/capability.ts";
import { FileOperationService } from "../../../file/services/FileOperationService.ts";
import { FileExcludeUtils } from "../../../file/utils/FileExcludeUtils.ts";
import { FileTypeUtils } from "../../../file/utils/FileTypeUtils.ts";
import { FileUtils } from "../../../file/utils/FileUtils.ts";
import { PathUtils } from "../../../file/utils/PathUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { ShellUtils } from "../../utils/ShellUtils.ts";

/** Bytes of a non-text file that may be pulled into the conversation. */
const MAX_BINARY_BYTES = 5_000_000;

export const read_file = {
	name: "read_file",
	description:
		"Read a file. Text files come back as a window of lines: pass offset and limit to page through anything larger than the default window, and use grep_files first when you only need part of a long file.",
	input: z.object({
		path: z.string().describe("Path of the file to read."),
		offset: z
			.number()
			.optional()
			.describe("First line to read, 1-based (default 1)."),
		limit: z.number().optional().describe("Lines to read (default 1000)."),
	}),
	output: z.never(),
} as const satisfies ToolDefinition;

export const createReadFileTool: ToolFactory<
	Tool<typeof read_file, Pick<Capabilities, "shell" | "chatShell">>
> = (options) => ({
	...read_file,
	...options,
	execute: async ({ input }) => {
		const shell = ShellUtils.detect(input.path, options.capabilities);

		const file = await shell.readFile({
			path: input.path,
		});
		const mime = await FileTypeUtils.getMime(file);
		const data = FileUtils.getBufferFromBytes(file);

		// Images and other binaries are passed through whole — there is no useful
		// way to window them — but never at a size that would swamp the context.
		if (FileExcludeUtils.isBinary({ data })) {
			if (data.length > MAX_BINARY_BYTES) {
				throw new Error(
					`${file.path} is a ${mime} file of ${data.length} bytes, too large to read into the conversation.`,
				);
			}
			return [
				{
					type: "file",
					name: PathUtils.name(file),
					mime,
					data: FileUtils.getBase64FromBytes({ data }),
				},
			];
		}

		// Not binary, but not cleanly decodable either — an unknown encoding or a
		// few stray bytes. Reading it with replacement characters is far more
		// useful than refusing to read it at all.
		const content =
			FileUtils.getTextFromBytes({ data, mime }) ??
			new TextDecoder().decode(data);

		const window = FileOperationService.getTextWindow({
			path: file.path,
			content,
			offset: input.offset,
			limit: input.limit,
		});

		return [
			{
				type: "file",
				name: PathUtils.name(file),
				mime,
				data: FileUtils.getBase64FromBytes({
					data: new TextEncoder().encode(window.text),
				}),
			},
			...(window.notice
				? [{ type: "text" as const, value: window.notice }]
				: []),
		];
	},
});
