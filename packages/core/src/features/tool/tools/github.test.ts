import type { GitHubCapability } from "../../../core/types/capability.ts";
import type { zAgentContext } from "../../agent/types/agent.ts";
import { createGitHubCompareTool } from "./github/compare.ts";
import { createGitHubViewFileTool } from "./github/view_file.ts";
import { createGitHubViewIssueTool } from "./github/view_issue.ts";
import { createGitHubViewRepositoryTool } from "./github/view_repository.ts";

const context = {} as zAgentContext;

const execute = <T extends { execute: (props: any) => Promise<any> }>(
	tool: T,
	input: Parameters<T["execute"]>[0]["input"],
) => tool.execute({ input, feedback: undefined, context });

describe("github tools", () => {
	it("combines repository metadata, releases, and tags", async () => {
		const calls: string[] = [];
		const github: GitHubCapability = {
			request: async ({ path }) => {
				calls.push(path);
				if (path.endsWith("/releases")) {
					return [
						{
							name: "One",
							tag_name: "v1.0.0",
							body: "notes",
							html_url: "https://github.com/acme/tool/releases/1",
							draft: false,
							prerelease: false,
							published_at: "2026-01-01T00:00:00Z",
						},
					];
				}
				if (path.endsWith("/tags")) {
					return [
						{
							name: "v1.0.0",
							commit: { sha: "abc", url: "https://api.github.com/abc" },
						},
					];
				}
				return {
					full_name: "acme/tool",
					description: "A tool",
					html_url: "https://github.com/acme/tool",
					default_branch: "main",
					language: "TypeScript",
					topics: ["tools"],
					license: { name: "MIT", spdx_id: "MIT" },
					visibility: "public",
					archived: false,
					stargazers_count: 1,
					forks_count: 2,
					open_issues_count: 3,
					pushed_at: "2026-01-02T00:00:00Z",
				};
			},
		};
		const tool = await createGitHubViewRepositoryTool({
			capabilities: { github },
		});

		const result = await execute(tool, { owner: "acme", repository: "tool" });

		expect(calls).toEqual([
			"/repos/acme/tool",
			"/repos/acme/tool/releases",
			"/repos/acme/tool/tags",
		]);
		expect(result[0]).toMatchObject({
			type: "json",
			value: {
				repository: { full_name: "acme/tool" },
				releases: [{ tag_name: "v1.0.0" }],
				tags: [{ name: "v1.0.0" }],
			},
		});
	});

	it("encodes remote paths and returns a bounded text window", async () => {
		const request = vi.fn(async () => ({
			type: "file",
			name: "a file.ts",
			path: "src/a file.ts",
			sha: "abc",
			size: 17,
			html_url: "https://github.com/acme/tool/blob/main/src/a%20file.ts",
			download_url: null,
			encoding: "base64",
			content: btoa("one\ntwo\nthree\nfour"),
		}));
		const tool = await createGitHubViewFileTool({
			capabilities: { github: { request } },
		});

		const result = await execute(tool, {
			owner: "acme",
			repository: "tool",
			path: "src/a file.ts",
			ref: "feature/x",
			offset: 2,
			limit: 2,
		});

		expect(request).toHaveBeenCalledWith({
			path: "/repos/acme/tool/contents/src/a%20file.ts",
			query: { ref: "feature/x" },
		});
		expect(result[0]).toMatchObject({
			type: "json",
			value: {
				kind: "file",
				offset: 2,
				lines: 2,
				total_lines: 4,
				content: "two\nthree",
				truncated: true,
			},
		});
	});

	it("enriches pull requests with comments and changed-file patches", async () => {
		const github: GitHubCapability = {
			request: async ({ path }) => {
				if (path.endsWith("/issues/7")) {
					return {
						number: 7,
						title: "Fix it",
						body: "Details",
						state: "open",
						html_url: "https://github.com/acme/tool/pull/7",
						user: { login: "octo", html_url: "https://github.com/octo" },
						labels: [],
						comments: 1,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-02T00:00:00Z",
						closed_at: null,
						pull_request: { url: "https://api.github.com/pulls/7" },
					};
				}
				if (path.endsWith("/issues/7/comments")) return [];
				if (path.endsWith("/pulls/7/files")) {
					return [
						{
							filename: "src/a.ts",
							status: "modified",
							additions: 1,
							deletions: 1,
							changes: 2,
							raw_url: "https://github.com/raw",
							blob_url: "https://github.com/blob",
							patch: "@@ -1 +1 @@",
						},
					];
				}
				if (path.endsWith("/pulls/7/comments")) return [];
				return {
					number: 7,
					title: "Fix it",
					body: "Details",
					state: "open",
					html_url: "https://github.com/acme/tool/pull/7",
					user: { login: "octo", html_url: "https://github.com/octo" },
					labels: [],
					draft: false,
					created_at: "2026-01-01T00:00:00Z",
					updated_at: "2026-01-02T00:00:00Z",
					closed_at: null,
					merged_at: null,
					head: { ref: "fix", sha: "head" },
					base: { ref: "main", sha: "base" },
				};
			},
		};
		const tool = await createGitHubViewIssueTool({ capabilities: { github } });

		const result = await execute(tool, {
			owner: "acme",
			repository: "tool",
			number: 7,
		});

		expect(result[0]).toMatchObject({
			type: "json",
			value: {
				item: { kind: "pull_request", number: 7 },
				pull_request: { head: { ref: "fix" }, base: { ref: "main" } },
				files: [{ filename: "src/a.ts", patch: "@@ -1 +1 @@" }],
			},
		});
	});

	it("compares arbitrary refs and returns changed-file patches", async () => {
		const request = vi.fn(async () => ({
			status: "ahead",
			ahead_by: 2,
			behind_by: 0,
			total_commits: 2,
			html_url: "https://github.com/acme/tool/compare/main...feature/x",
			base_commit: { sha: "base" },
			merge_base_commit: { sha: "merge-base" },
			commits: [
				{
					sha: "head",
					html_url: "https://github.com/acme/tool/commit/head",
					commit: {
						message: "Change it",
						author: { name: "Octo", date: "2026-01-01T00:00:00Z" },
					},
				},
			],
			files: [
				{
					filename: "src/a.ts",
					status: "modified",
					additions: 1,
					deletions: 0,
					changes: 1,
					raw_url: "https://github.com/raw",
					blob_url: "https://github.com/blob",
					patch: "+new",
				},
			],
		}));
		const tool = await createGitHubCompareTool({
			capabilities: { github: { request } },
		});

		const result = await execute(tool, {
			owner: "acme",
			repository: "tool",
			base: "main",
			head: "feature/x",
		});

		expect(request).toHaveBeenCalledWith({
			path: "/repos/acme/tool/compare/main...feature%2Fx",
			query: { page: 1, per_page: 30 },
		});
		expect(result[0]).toMatchObject({
			type: "json",
			value: {
				status: "ahead",
				commits: [{ sha: "head", message: "Change it" }],
				files: [{ filename: "src/a.ts", patch: "+new" }],
			},
		});
	});
});
