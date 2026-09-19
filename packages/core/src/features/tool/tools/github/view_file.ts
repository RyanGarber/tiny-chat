import { z } from "zod";
import type { GitHubCapability } from "../../../../core/types/capability.ts";
import { FileOperationService } from "../../../file/services/FileOperationService.ts";
import { FileUtils } from "../../../file/utils/FileUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { GitHubToolUtils } from "../../utils/GitHubToolUtils.ts";

const zContentEntry = z.object({
	type: z.string(),
	name: z.string(),
	path: z.string(),
	sha: z.string(),
	size: z.number(),
	html_url: z.string().nullable(),
	download_url: z.string().nullable(),
});

const zFile = z.object({
	type: z.string(),
	name: z.string(),
	path: z.string(),
	sha: z.string(),
	size: z.number(),
	html_url: z.string().nullable(),
	download_url: z.string().nullable(),
	encoding: z.string().optional(),
	content: z.string().optional(),
});

const zFileOutput = z.object({
	kind: z.literal("file"),
	path: z.string(),
	sha: z.string(),
	size: z.number(),
	html_url: z.string().nullable(),
	offset: z.number(),
	lines: z.number(),
	total_lines: z.number(),
	truncated: z.boolean(),
	content: z.string(),
	notice: z.string().optional(),
});

const zDirectoryOutput = z.object({
	kind: z.literal("directory"),
	path: z.string(),
	entries: z.array(zContentEntry),
	truncated: z.boolean(),
});

export const github_view_file = {
	name: "github_view_file",
	description:
		"Read a text file or list a directory in a GitHub repository at any branch, tag, or commit. Use offset and limit to page through long files.",
	input: z.object({
		owner: z.string(),
		repository: z.string(),
		path: z.string().optional().default(""),
		ref: z.string().optional().describe("Branch, tag, or commit SHA."),
		offset: z.number().optional().describe("First line to read, 1-based."),
		limit: z.number().optional().describe("Lines to read (default 400)."),
	}),
	output: z.union([zFileOutput, zDirectoryOutput]),
} as const satisfies ToolDefinition;

export const createGitHubViewFileTool: ToolFactory<
	Tool<typeof github_view_file, { github: GitHubCapability }>
> = (options) => ({
	...github_view_file,
	...options,
	execute: async ({ input }) => {
		const suffix = input.path
			? `/contents/${input.path.split("/").map(GitHubToolUtils.segment).join("/")}`
			: "/contents";
		const value = await options.capabilities.github.request({
			path: GitHubToolUtils.repositoryPath({ ...input, suffix }),
			query: { ref: input.ref },
		});

		const directory = z.array(zContentEntry).safeParse(value);
		if (directory.success) {
			const entries = directory.data.slice(0, 200);
			return [
				{
					type: "json",
					value: {
						kind: "directory" as const,
						path: input.path,
						entries,
						truncated: directory.data.length > entries.length,
					},
				},
			];
		}

		const file = zFile.parse(value);
		if (file.type !== "file") {
			throw new Error(
				`${file.path} is a ${file.type}, not a readable text file.`,
			);
		}
		if (file.encoding !== "base64" || !file.content) {
			throw new Error(
				`${file.path} is too large or uses an unsupported encoding; open ${file.html_url ?? file.download_url ?? "the file on GitHub"}.`,
			);
		}

		const data = FileUtils.getBufferFromBytes({
			data: file.content.replaceAll("\n", ""),
		});
		const content = FileUtils.getTextFromBytes({ data });
		if (content === null) throw new Error(`${file.path} is not a text file.`);

		const window = FileOperationService.getTextWindow({
			path: file.path,
			content,
			offset: input.offset,
			limit: Math.min(1_000, Math.max(1, input.limit ?? 400)),
		});
		return [
			{
				type: "json",
				value: {
					kind: "file" as const,
					path: file.path,
					sha: file.sha,
					size: file.size,
					html_url: file.html_url,
					offset: window.offset,
					lines: window.lines,
					total_lines: window.total,
					truncated: window.truncated,
					content: window.text,
					...(window.notice ? { notice: window.notice } : {}),
				},
			},
		];
	},
});
