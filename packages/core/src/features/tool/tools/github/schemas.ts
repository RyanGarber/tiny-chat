import { z } from "zod";
import { zGitHubLabel, zGitHubUser } from "../../utils/GitHubToolUtils.ts";

export const zGitHubIssue = z.object({
	number: z.number(),
	title: z.string(),
	body: z.string().nullable(),
	state: z.string(),
	state_reason: z.string().nullable().optional(),
	html_url: z.string(),
	user: zGitHubUser,
	labels: z.array(zGitHubLabel),
	comments: z.number(),
	created_at: z.string(),
	updated_at: z.string(),
	closed_at: z.string().nullable(),
	pull_request: z.object({ url: z.string() }).optional(),
});

export const zGitHubPullRequest = z.object({
	number: z.number(),
	title: z.string(),
	body: z.string().nullable(),
	state: z.string(),
	html_url: z.string(),
	user: zGitHubUser,
	labels: z.array(zGitHubLabel),
	draft: z.boolean(),
	created_at: z.string(),
	updated_at: z.string(),
	closed_at: z.string().nullable(),
	merged_at: z.string().nullable(),
	mergeable: z.boolean().nullable().optional(),
	mergeable_state: z.string().optional(),
	comments: z.number().optional(),
	review_comments: z.number().optional(),
	commits: z.number().optional(),
	additions: z.number().optional(),
	deletions: z.number().optional(),
	changed_files: z.number().optional(),
	head: z.object({ ref: z.string(), sha: z.string() }),
	base: z.object({ ref: z.string(), sha: z.string() }),
});

export const zGitHubComment = z.object({
	id: z.number(),
	html_url: z.string(),
	user: zGitHubUser,
	body: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
});

export const zGitHubReviewComment = z.object({
	id: z.number(),
	html_url: z.string(),
	user: zGitHubUser,
	body: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
	path: z.string(),
	diff_hunk: z.string(),
	commit_id: z.string(),
	line: z.number().nullable().optional(),
	start_line: z.number().nullable().optional(),
});

export const zGitHubPullRequestFile = z.object({
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

export const zGitHubDiffFile = zGitHubPullRequestFile;

export const zGitHubIssueSummaryOutput = z.object({
	kind: z.enum(["issue", "pull_request"]),
	number: z.number(),
	title: z.string(),
	body: z.string().nullable(),
	state: z.string(),
	html_url: z.string(),
	author: z.string().nullable(),
	labels: z.array(zGitHubLabel),
	created_at: z.string(),
	updated_at: z.string(),
	closed_at: z.string().nullable(),
	draft: z.boolean().optional(),
});
