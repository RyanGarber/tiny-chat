import { z } from "zod";
import type { GitHubCapability } from "../../../../core/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { GitHubToolUtils } from "../../utils/GitHubToolUtils.ts";
import {
	zGitHubIssue,
	zGitHubIssueSummaryOutput,
	zGitHubPullRequest,
} from "./schemas.ts";

export const github_list_issues = {
	name: "github_list_issues",
	description:
		"List issues or pull requests in a GitHub repository. Use github_view_issue for full bodies, comments, and pull-request diffs.",
	input: z.object({
		owner: z.string(),
		repository: z.string(),
		kind: z.enum(["issues", "pull_requests"]).optional().default("issues"),
		state: z.enum(["open", "closed", "all"]).optional().default("open"),
		sort: z.enum(["created", "updated"]).optional().default("updated"),
		direction: z.enum(["asc", "desc"]).optional().default("desc"),
		page: z.number().optional(),
		limit: z.number().optional().describe("Items to return (default 20)."),
	}),
	output: zGitHubIssueSummaryOutput,
} as const satisfies ToolDefinition;

export const createGitHubListIssuesTool: ToolFactory<
	Tool<typeof github_list_issues, { github: GitHubCapability }>
> = (options) => ({
	...github_list_issues,
	...options,
	execute: async ({ input }) => {
		const limit = GitHubToolUtils.limit(input.limit, 20, 50);
		const path = GitHubToolUtils.repositoryPath({
			...input,
			suffix: input.kind === "issues" ? "/issues" : "/pulls",
		});

		if (input.kind === "pull_requests") {
			const pulls = await GitHubToolUtils.request({
				github: options.capabilities.github,
				path,
				query: {
					state: input.state,
					sort: input.sort,
					direction: input.direction,
					page: GitHubToolUtils.page(input.page),
					per_page: limit,
				},
				schema: z.array(zGitHubPullRequest),
			});
			return pulls.map((pull) => ({
				type: "json" as const,
				value: {
					kind: "pull_request" as const,
					number: pull.number,
					title: pull.title,
					body: GitHubToolUtils.clip(pull.body, 2_000),
					state: pull.state,
					html_url: pull.html_url,
					author: pull.user?.login ?? null,
					labels: pull.labels,
					created_at: pull.created_at,
					updated_at: pull.updated_at,
					closed_at: pull.closed_at,
					draft: pull.draft,
				},
			}));
		}

		// GitHub's issues endpoint includes pull requests, so fetch a wider page
		// and remove them before returning issue-only results.
		const issues = await GitHubToolUtils.request({
			github: options.capabilities.github,
			path,
			query: {
				state: input.state,
				sort: input.sort,
				direction: input.direction,
				page: GitHubToolUtils.page(input.page),
				per_page: 100,
			},
			schema: z.array(zGitHubIssue),
		});
		return issues
			.filter((issue) => !issue.pull_request)
			.slice(0, limit)
			.map((issue) => ({
				type: "json" as const,
				value: {
					kind: "issue" as const,
					number: issue.number,
					title: issue.title,
					body: GitHubToolUtils.clip(issue.body, 2_000),
					state: issue.state,
					html_url: issue.html_url,
					author: issue.user?.login ?? null,
					labels: issue.labels,
					created_at: issue.created_at,
					updated_at: issue.updated_at,
					closed_at: issue.closed_at,
				},
			}));
	},
});
