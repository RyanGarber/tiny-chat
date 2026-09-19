import { z } from "zod";
import type { GitHubCapability } from "../../../../core/types/capability.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";
import { GitHubToolUtils } from "../../utils/GitHubToolUtils.ts";
import {
	zGitHubComment,
	zGitHubIssue,
	zGitHubIssueSummaryOutput,
	zGitHubPullRequest,
	zGitHubPullRequestFile,
	zGitHubReviewComment,
} from "./schemas.ts";

const zCommentOutput = z.object({
	id: z.number(),
	html_url: z.string(),
	author: z.string().nullable(),
	body: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
});

const zReviewCommentOutput = zCommentOutput.extend({
	path: z.string(),
	diff_hunk: z.string(),
	commit_id: z.string(),
	line: z.number().nullable().optional(),
	start_line: z.number().nullable().optional(),
});

export const github_view_issue = {
	name: "github_view_issue",
	description:
		"View a GitHub issue or pull request. Pull requests include branch/merge metadata, changed-file patches, discussion comments, and review comments.",
	input: z.object({
		owner: z.string(),
		repository: z.string(),
		number: z.number(),
		comment_page: z.number().optional(),
		file_page: z.number().optional(),
		max_comments: z
			.number()
			.optional()
			.describe("Comments of each kind (default 20)."),
		max_files: z.number().optional().describe("Changed files (default 30)."),
	}),
	output: z.object({
		item: zGitHubIssueSummaryOutput.extend({ body: z.string().nullable() }),
		state_reason: z.string().nullable().optional(),
		comments: z.array(zCommentOutput),
		pull_request: zGitHubPullRequest.optional(),
		files: z.array(zGitHubPullRequestFile).optional(),
		review_comments: z.array(zReviewCommentOutput).optional(),
		comment_page: z.number(),
		file_page: z.number().optional(),
	}),
} as const satisfies ToolDefinition;

export const createGitHubViewIssueTool: ToolFactory<
	Tool<typeof github_view_issue, { github: GitHubCapability }>
> = (options) => ({
	...github_view_issue,
	...options,
	execute: async ({ input }) => {
		const root = GitHubToolUtils.repositoryPath(input);
		const number = GitHubToolUtils.segment(input.number);
		const commentPage = GitHubToolUtils.page(input.comment_page);
		const filePage = GitHubToolUtils.page(input.file_page);
		const maxComments = GitHubToolUtils.limit(input.max_comments, 20, 50);
		const issuePath = `${root}/issues/${number}`;

		const [issue, comments] = await Promise.all([
			GitHubToolUtils.request({
				github: options.capabilities.github,
				path: issuePath,
				schema: zGitHubIssue,
			}),
			GitHubToolUtils.request({
				github: options.capabilities.github,
				path: `${issuePath}/comments`,
				query: { page: commentPage, per_page: maxComments },
				schema: z.array(zGitHubComment),
			}),
		]);

		const commentOutput = comments.map(({ user, ...comment }) => ({
			...comment,
			author: user?.login ?? null,
			body: GitHubToolUtils.clip(comment.body, 8_000) ?? "",
		}));
		const item = {
			kind: issue.pull_request ? ("pull_request" as const) : ("issue" as const),
			number: issue.number,
			title: issue.title,
			body: GitHubToolUtils.clip(issue.body),
			state: issue.state,
			html_url: issue.html_url,
			author: issue.user?.login ?? null,
			labels: issue.labels,
			created_at: issue.created_at,
			updated_at: issue.updated_at,
			closed_at: issue.closed_at,
		};

		if (!issue.pull_request) {
			return [
				{
					type: "json",
					value: {
						item,
						state_reason: issue.state_reason,
						comments: commentOutput,
						comment_page: commentPage,
					},
				},
			];
		}

		const pullPath = `${root}/pulls/${number}`;
		const [pullRequest, files, reviewComments] = await Promise.all([
			GitHubToolUtils.request({
				github: options.capabilities.github,
				path: pullPath,
				schema: zGitHubPullRequest,
			}),
			GitHubToolUtils.request({
				github: options.capabilities.github,
				path: `${pullPath}/files`,
				query: {
					page: filePage,
					per_page: GitHubToolUtils.limit(input.max_files, 30),
				},
				schema: z.array(zGitHubPullRequestFile),
			}),
			GitHubToolUtils.request({
				github: options.capabilities.github,
				path: `${pullPath}/comments`,
				query: { page: commentPage, per_page: maxComments },
				schema: z.array(zGitHubReviewComment),
			}),
		]);

		return [
			{
				type: "json",
				value: {
					item: { ...item, draft: pullRequest.draft },
					comments: commentOutput,
					pull_request: {
						...pullRequest,
						body: GitHubToolUtils.clip(pullRequest.body),
					},
					files: files.map((file) => ({
						...file,
						...(file.patch
							? { patch: GitHubToolUtils.clip(file.patch, 12_000) ?? undefined }
							: {}),
					})),
					review_comments: reviewComments.map(({ user, ...comment }) => ({
						...comment,
						author: user?.login ?? null,
						body: GitHubToolUtils.clip(comment.body, 8_000) ?? "",
						diff_hunk: GitHubToolUtils.clip(comment.diff_hunk, 8_000) ?? "",
					})),
					comment_page: commentPage,
					file_page: filePage,
				},
			},
		];
	},
});
