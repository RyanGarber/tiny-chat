import { z } from "zod";
import type { GitHubCapability } from "../../../../core/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { GitHubToolUtils } from "../../utils/GitHubToolUtils.ts";
import { zGitHubDiffFile } from "./schemas.ts";

const zComparedCommit = z.object({
	sha: z.string(),
	html_url: z.string(),
	commit: z.object({
		message: z.string(),
		author: z.object({ name: z.string(), date: z.string() }),
	}),
});

const zComparison = z.object({
	status: z.string(),
	ahead_by: z.number(),
	behind_by: z.number(),
	total_commits: z.number(),
	html_url: z.string(),
	base_commit: z.object({ sha: z.string() }),
	merge_base_commit: z.object({ sha: z.string() }),
	commits: z.array(zComparedCommit),
	files: z.array(zGitHubDiffFile).optional().default([]),
});

export const github_compare = {
	name: "github_compare",
	description:
		"Compare two GitHub branches, tags, or commit SHAs and view the commits and changed-file patches between them.",
	input: z.object({
		owner: z.string(),
		repository: z.string(),
		base: z.string().describe("Base branch, tag, or commit SHA."),
		head: z
			.string()
			.describe(
				"Head branch, tag, or commit SHA. A fork branch may use owner:branch.",
			),
		page: z.number().optional(),
		max_commits: z
			.number()
			.optional()
			.describe("Commits to return (default 30)."),
	}),
	output: z.object({
		status: z.string(),
		ahead_by: z.number(),
		behind_by: z.number(),
		total_commits: z.number(),
		html_url: z.string(),
		base_sha: z.string(),
		merge_base_sha: z.string(),
		page: z.number(),
		commits: z.array(
			z.object({
				sha: z.string(),
				html_url: z.string(),
				message: z.string(),
				author: z.string(),
				date: z.string(),
			}),
		),
		files: z.array(zGitHubDiffFile),
	}),
} as const satisfies ToolDefinition;

export const createGitHubCompareTool: ToolFactory<
	Tool<typeof github_compare, { github: GitHubCapability }>
> = (options) => ({
	...github_compare,
	...options,
	execute: async ({ input }) => {
		const page = GitHubToolUtils.page(input.page);
		const comparison = await GitHubToolUtils.request({
			github: options.capabilities.github,
			path: GitHubToolUtils.repositoryPath({
				...input,
				suffix: `/compare/${GitHubToolUtils.segment(`${input.base}...${input.head}`)}`,
			}),
			query: {
				page,
				per_page: GitHubToolUtils.limit(input.max_commits, 30),
			},
			schema: zComparison,
		});

		return [
			{
				type: "json",
				value: {
					status: comparison.status,
					ahead_by: comparison.ahead_by,
					behind_by: comparison.behind_by,
					total_commits: comparison.total_commits,
					html_url: comparison.html_url,
					base_sha: comparison.base_commit.sha,
					merge_base_sha: comparison.merge_base_commit.sha,
					page,
					commits: comparison.commits.map((commit) => ({
						sha: commit.sha,
						html_url: commit.html_url,
						message: commit.commit.message,
						author: commit.commit.author.name,
						date: commit.commit.author.date,
					})),
					files: comparison.files.map((file) => ({
						...file,
						...(file.patch
							? { patch: GitHubToolUtils.clip(file.patch, 12_000) ?? undefined }
							: {}),
					})),
				},
			},
		];
	},
});
