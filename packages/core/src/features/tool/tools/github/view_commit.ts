import { z } from "zod";
import type { GitHubCapability } from "../../../../core/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { GitHubToolUtils, zGitHubUser } from "../../utils/GitHubToolUtils.ts";

const zCommitFile = z.object({
	filename: z.string(),
	status: z.string(),
	additions: z.number(),
	deletions: z.number(),
	changes: z.number(),
	raw_url: z.string(),
	blob_url: z.string(),
	previous_filename: z.string().optional(),
	patch: z.string().optional(),
});

const zCommit = z.object({
	sha: z.string(),
	html_url: z.string(),
	author: zGitHubUser,
	committer: zGitHubUser,
	commit: z.object({
		message: z.string(),
		author: z.object({ name: z.string(), email: z.string(), date: z.string() }),
		committer: z.object({
			name: z.string(),
			email: z.string(),
			date: z.string(),
		}),
	}),
	stats: z.object({
		total: z.number(),
		additions: z.number(),
		deletions: z.number(),
	}),
	files: z.array(zCommitFile).optional().default([]),
});

export const github_view_commit = {
	name: "github_view_commit",
	description:
		"View a GitHub commit with its message, stats, changed files, and text patches. Page through very large commits with file_page.",
	input: z.object({
		owner: z.string(),
		repository: z.string(),
		ref: z.string().describe("Commit SHA, branch, or tag."),
		file_page: z.number().optional(),
		max_files: z.number().optional().describe("Files to return (default 30)."),
	}),
	output: z.object({
		sha: z.string(),
		html_url: z.string(),
		message: z.string(),
		author: z.object({
			name: z.string(),
			login: z.string().nullable(),
			date: z.string(),
		}),
		committer: z.object({
			name: z.string(),
			login: z.string().nullable(),
			date: z.string(),
		}),
		stats: z.object({
			total: z.number(),
			additions: z.number(),
			deletions: z.number(),
		}),
		file_page: z.number(),
		files: z.array(zCommitFile),
	}),
} as const satisfies ToolDefinition;

export const createGitHubViewCommitTool: ToolFactory<
	Tool<typeof github_view_commit, { github: GitHubCapability }>
> = (options) => ({
	...github_view_commit,
	...options,
	execute: async ({ input }) => {
		const filePage = GitHubToolUtils.page(input.file_page);
		const commit = await GitHubToolUtils.request({
			github: options.capabilities.github,
			path: GitHubToolUtils.repositoryPath({
				...input,
				suffix: `/commits/${GitHubToolUtils.segment(input.ref)}`,
			}),
			query: {
				page: filePage,
				per_page: GitHubToolUtils.limit(input.max_files, 30),
			},
			schema: zCommit,
		});

		return [
			{
				type: "json",
				value: {
					sha: commit.sha,
					html_url: commit.html_url,
					message: commit.commit.message,
					author: {
						name: commit.commit.author.name,
						login: commit.author?.login ?? null,
						date: commit.commit.author.date,
					},
					committer: {
						name: commit.commit.committer.name,
						login: commit.committer?.login ?? null,
						date: commit.commit.committer.date,
					},
					stats: commit.stats,
					file_page: filePage,
					files: commit.files.map((file) => ({
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
