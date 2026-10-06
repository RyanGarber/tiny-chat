import type {
	zToolCallPart,
	zToolResultPart,
} from "#core/features/data/types/part.ts";
import { SourceUtils } from "#core/features/data/utils/SourceUtils.ts";
import { createGitHubToolset } from "#core/features/tool/tools/github.ts";
import { GitHubSourceUtils } from "#core/features/tool/utils/GitHubSourceUtils.ts";
import { ToolCallUtils } from "#core/features/tool/utils/ToolCallUtils.ts";

const root = "https://github.com/acme/tool";
const author = { name: "A", login: "a", date: "2026-01-01" };
const commit = {
	sha: "abcdef123",
	html_url: `${root}/commit/abcdef123`,
	message: "Fix bug\n\nDetails",
	author,
	committer: author,
};
const file = {
	filename: "src/index.ts",
	status: "modified",
	additions: 1,
	deletions: 1,
	changes: 2,
	blob_url: `${root}/blob/abcdef123/src/index.ts`,
	raw_url: "https://raw.githubusercontent.com/acme/tool/abcdef123/src/index.ts",
	patch: "@@ -1 +1 @@\n-old\n+new",
};
const issue = {
	kind: "pull_request",
	number: 7,
	title: "Fix bug",
	body: "Description",
	state: "open",
	html_url: `${root}/pull/7`,
	author: "a",
	labels: [],
	created_at: "today",
	updated_at: "today",
	closed_at: null,
};
const fixtures = [
	{
		name: "github_view_repository",
		input: {},
		values: [
			{
				repository: {
					full_name: "acme/tool",
					description: "A tool",
					html_url: root,
					default_branch: "main",
					language: "TypeScript",
					topics: [],
					license: null,
					visibility: "public",
					archived: false,
					stargazers_count: 1,
					forks_count: 0,
					open_issues_count: 1,
					pushed_at: null,
				},
				releases: [
					{
						name: "Release one",
						tag_name: "v1.0",
						body: "Release notes",
						html_url: `${root}/releases/tag/v1.0`,
						draft: false,
						prerelease: false,
						published_at: null,
					},
				],
				tags: [
					{
						name: "release/v1",
						commit: { sha: "abcdef123", url: "https://api.github.com/commit" },
					},
				],
			},
		],
		titles: ["acme/tool", "v1.0", "release/v1"],
	},
	{
		name: "github_view_file",
		input: { path: "src/index.ts", ref: "main" },
		values: [
			{
				kind: "file",
				path: "src/index.ts",
				sha: "abc",
				size: 10,
				html_url: file.blob_url,
				offset: 1,
				lines: 1,
				total_lines: 1,
				truncated: false,
				content: "const text = `hello`;",
			},
		],
		titles: ["src/index.ts"],
	},
	{
		name: "github_list_commits",
		input: {},
		values: [commit],
		titles: ["abcdef1: Fix bug"],
	},
	{
		name: "github_view_commit",
		input: { ref: "main" },
		values: [
			{
				...commit,
				stats: { total: 2, additions: 1, deletions: 1 },
				file_page: 1,
				files: [file],
			},
		],
		titles: ["abcdef1: Fix bug", "src/index.ts"],
	},
	{
		name: "github_compare",
		input: { base: "v1", head: "v2" },
		values: [
			{
				status: "ahead",
				ahead_by: 1,
				behind_by: 0,
				total_commits: 1,
				html_url: `${root}/compare/v1...v2`,
				base_sha: "a",
				merge_base_sha: "a",
				page: 1,
				commits: [{ ...commit, author: "A", date: "today" }],
				files: [file],
			},
		],
		titles: ["v1...v2", "abcdef1: Fix bug", "src/index.ts"],
	},
	{
		name: "github_list_issues",
		input: { kind: "pull_requests" },
		values: [issue],
		titles: ["#7: Fix bug"],
	},
	{
		name: "github_view_issue",
		input: { number: 7 },
		values: [
			{
				item: issue,
				comments: [
					{
						id: 1,
						html_url: `${root}/pull/7#issuecomment-1`,
						author: "a",
						body: "Discussion",
						created_at: "today",
						updated_at: "today",
					},
				],
				review_comments: [
					{
						id: 2,
						html_url: `${root}/pull/7#discussion_r2`,
						author: "b",
						body: "Review",
						created_at: "today",
						updated_at: "today",
						path: file.filename,
						diff_hunk: file.patch,
						commit_id: "abc",
					},
				],
				files: [file],
				comment_page: 1,
			},
		],
		titles: [
			"#7: Fix bug",
			"#7: Comment by a",
			"#7: Comment by b",
			"src/index.ts",
		],
	},
];

const toolsets = [
	await createGitHubToolset({
		capabilities: {
			github: {
				request: async () => {
					throw new Error("Presentation must not request GitHub");
				},
			},
		},
		status: { valid: true },
		prefix: "remote",
	}),
];

const parts = (fixture: (typeof fixtures)[number]) => {
	const part: zToolCallPart = {
		type: "toolCall",
		id: fixture.name,
		name: `remote_${fixture.name}`,
		input: { owner: "acme", repository: "tool", ...fixture.input },
	};
	const result: zToolResultPart = {
		type: "toolResult",
		id: part.id,
		name: part.name,
		output: fixture.values.map((value) => ({
			id: "output",
			type: "json",
			value,
		})),
	};
	return { part, result };
};

describe("GitHub presentation", () => {
	it.each(fixtures)(
		"extracts sources and displays $name with a toolset prefix",
		(fixture) => {
			const { part, result } = parts(fixture);
			const sources = SourceUtils.find({
				message: { data: [[part, result]] },
				toolsets,
			});
			expect(
				sources.map((source) => source.type === "web" && source.value.title),
			).toEqual(fixture.titles);
			const pending = ToolCallUtils.getDisplay({ part, toolsets });
			expect(pending.name).toBe(fixture.name);
			expect(pending.state).toBe("running");
			const completed = ToolCallUtils.getDisplay({
				part: { ...part, result },
				toolsets,
			});
			expect(completed.state).toBe("success");
			expect(completed.status).not.toEqual(pending.status);
			expect(completed.output).toEqual(
				sources.map((source) => ({ type: "web", source: source.value })),
			);
		},
	);

	it("ignores failed, missing, and malformed results", () => {
		const { part, result } = parts(fixtures[1]);
		expect(SourceUtils.find({ message: { data: [[part]] }, toolsets })).toEqual(
			[],
		);
		expect(
			SourceUtils.find({
				message: { data: [[part, { ...result, error: true }]] },
				toolsets,
			}),
		).toEqual([]);
		expect(
			GitHubSourceUtils.parse("github_view_file", [null, { kind: "file" }]),
		).toEqual([]);
	});

	it("keeps file code fenced and tag URLs encoded", () => {
		const sources = GitHubSourceUtils.parse(
			fixtures[1].name,
			fixtures[1].values,
		);
		expect(sources[0].content).toContain("```\nconst text = `hello`;\n```");
		const repository = GitHubSourceUtils.parse(
			fixtures[0].name,
			fixtures[0].values,
		);
		expect(repository.at(-1)?.url).toBe(`${root}/tree/release%2Fv1`);
	});

	it("extracts directory entries with URLs and skips null links", () => {
		const entry = {
			type: "file",
			name: "index.ts",
			path: "src/index.ts",
			sha: "abc",
			size: 1,
			html_url: file.blob_url,
			download_url: null,
		};
		expect(
			GitHubSourceUtils.parse("github_view_file", [
				{
					kind: "directory",
					path: "src",
					entries: [entry, { ...entry, html_url: null }],
					truncated: false,
				},
			]),
		).toEqual([
			{
				url: file.blob_url,
				title: "src/index.ts",
				content: "file: src/index.ts\n\n1 bytes · abc",
			},
		]);
	});
});
