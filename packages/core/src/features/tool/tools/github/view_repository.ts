import { z } from "zod";
import type { GitHubCapability } from "../../../../core/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { GitHubToolUtils } from "../../utils/GitHubToolUtils.ts";

const zRepository = z.object({
	full_name: z.string(),
	description: z.string().nullable(),
	html_url: z.string(),
	default_branch: z.string(),
	language: z.string().nullable(),
	topics: z.array(z.string()),
	license: z
		.object({ name: z.string(), spdx_id: z.string().nullable() })
		.nullable(),
	visibility: z.string(),
	archived: z.boolean(),
	stargazers_count: z.number(),
	forks_count: z.number(),
	open_issues_count: z.number(),
	pushed_at: z.string().nullable(),
});

const zRelease = z.object({
	name: z.string().nullable(),
	tag_name: z.string(),
	body: z.string().nullable(),
	html_url: z.string(),
	draft: z.boolean(),
	prerelease: z.boolean(),
	published_at: z.string().nullable(),
});

const zTag = z.object({
	name: z.string(),
	commit: z.object({ sha: z.string(), url: z.string() }),
});

export const github_view_repository = {
	name: "github_view_repository",
	description:
		"View a GitHub repository's description, language, activity, latest releases, and tags.",
	input: z.object({
		owner: z.string().describe("Repository owner or organization."),
		repository: z.string().describe("Repository name."),
	}),
	output: z.object({
		repository: zRepository,
		releases: z.array(zRelease),
		tags: z.array(zTag),
	}),
} as const satisfies ToolDefinition;

export const createGitHubViewRepositoryTool: ToolFactory<
	Tool<typeof github_view_repository, { github: GitHubCapability }>
> = (options) => ({
	...github_view_repository,
	...options,
	execute: async ({ input }) => {
		const path = GitHubToolUtils.repositoryPath(input);
		const [repository, releases, tags] = await Promise.all([
			GitHubToolUtils.request({
				github: options.capabilities.github,
				path,
				schema: zRepository,
			}),
			GitHubToolUtils.request({
				github: options.capabilities.github,
				path: `${path}/releases`,
				query: { per_page: 5 },
				schema: z.array(zRelease),
			}),
			GitHubToolUtils.request({
				github: options.capabilities.github,
				path: `${path}/tags`,
				query: { per_page: 10 },
				schema: z.array(zTag),
			}),
		]);

		return [
			{
				type: "json",
				value: {
					repository,
					releases: releases.map((release) => ({
						...release,
						body: GitHubToolUtils.clip(release.body, 8_000),
					})),
					tags,
				},
			},
		];
	},
});
