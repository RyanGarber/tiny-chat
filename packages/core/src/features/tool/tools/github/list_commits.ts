import { z } from "zod";
import type { GitHubCapability } from "../../../../core/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { GitHubToolUtils, zGitHubUser } from "../../utils/GitHubToolUtils.ts";

const zCommit = z.object({
	sha: z.string(),
	html_url: z.string(),
	author: zGitHubUser,
	committer: zGitHubUser,
	commit: z.object({
		message: z.string(),
		author: z.object({
			name: z.string(),
			email: z.string(),
			date: z.string(),
		}),
		committer: z.object({
			name: z.string(),
			email: z.string(),
			date: z.string(),
		}),
	}),
});

export const github_list_commits = {
	name: "github_list_commits",
	description:
		"List recent commits in a GitHub repository, optionally starting from a branch/tag/SHA or limited to a file path.",
	input: z.object({
		owner: z.string(),
		repository: z.string(),
		ref: z.string().optional().describe("Branch, tag, or commit SHA."),
		path: z.string().optional().describe("Only commits touching this path."),
		page: z.number().optional(),
		limit: z.number().optional().describe("Commits to return (default 20)."),
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
	}),
} as const satisfies ToolDefinition;

export const createGitHubListCommitsTool: ToolFactory<
	Tool<typeof github_list_commits, { github: GitHubCapability }>
> = (options) => ({
	...github_list_commits,
	...options,
	execute: async ({ input }) => {
		const commits = await GitHubToolUtils.request({
			github: options.capabilities.github,
			path: GitHubToolUtils.repositoryPath({
				...input,
				suffix: "/commits",
			}),
			query: {
				sha: input.ref,
				path: input.path,
				page: GitHubToolUtils.page(input.page),
				per_page: GitHubToolUtils.limit(input.limit, 20),
			},
			schema: z.array(zCommit),
		});

		return commits.map((commit) => ({
			type: "json" as const,
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
			},
		}));
	},
});
