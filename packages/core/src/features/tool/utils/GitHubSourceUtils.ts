import type { zWebContext } from "../../provider/types/web.ts";
import { github_compare } from "../tools/github/compare.ts";
import { github_list_commits } from "../tools/github/list_commits.ts";
import { github_list_issues } from "../tools/github/list_issues.ts";
import { github_view_commit } from "../tools/github/view_commit.ts";
import { github_view_file } from "../tools/github/view_file.ts";
import { github_view_issue } from "../tools/github/view_issue.ts";
import { github_view_repository } from "../tools/github/view_repository.ts";

// Keep code intact when sources are opened in the Markdown source viewer.
const code = (value: string, language = "") => {
	const fence = "`".repeat(
		Math.max(
			3,
			...Array.from(value.matchAll(/`+/g), (match) => match[0].length + 1),
		),
	);
	return `${fence}${language}\n${value}\n${fence}`;
};

export const GitHubSourceUtils = {
	parse: (name: string, values: unknown[]): zWebContext[] => {
		const sources = new Map<string, zWebContext>();
		const add = (
			url: string | null | undefined,
			title: string,
			content: string,
		) => {
			if (!url) return;
			sources.set(url, { url, title, content });
		};
		const commit = (item: { html_url: string; sha: string; message: string }) =>
			add(
				item.html_url,
				`${item.sha.slice(0, 7)}: ${item.message.split("\n")[0]}`,
				item.message,
			);
		const files = (
			items: {
				blob_url?: string;
				filename: string;
				status: string;
				additions: number;
				deletions: number;
				patch?: string;
			}[],
		) => {
			for (const item of items)
				add(
					item.blob_url,
					item.filename,
					`${item.status} · +${item.additions} / -${item.deletions}\n\n${item.patch ? code(item.patch, "diff") : "Patch unavailable."}`,
				);
		};
		const issue = (item: {
			html_url: string;
			number: number;
			title: string;
			state: string;
			body: string | null;
		}) =>
			add(
				item.html_url,
				`#${item.number}: ${item.title}`,
				`${item.state}\n\n${item.body ?? ""}`,
			);

		for (const value of values) {
			if (name === github_view_repository.name) {
				const parsed = github_view_repository.output.safeParse(value);
				if (!parsed.success) continue;
				const { repository, releases, tags } = parsed.data;
				add(
					repository.html_url,
					repository.full_name,
					[
						repository.description,
						repository.language,
						`Default branch: ${repository.default_branch}`,
						`${repository.stargazers_count} stars · ${repository.forks_count} forks`,
						repository.topics.join(", "),
					]
						.filter(Boolean)
						.join("\n\n"),
				);
				for (const release of releases)
					add(
						release.html_url,
						release.tag_name,
						[release.name, release.published_at, release.body]
							.filter(Boolean)
							.join("\n\n"),
					);
				for (const tag of tags)
					add(
						`${repository.html_url}/tree/${encodeURIComponent(tag.name)}`,
						tag.name,
						`Tag ${tag.name}\n\nCommit: ${tag.commit.sha}`,
					);
			} else if (name === github_view_file.name) {
				const parsed = github_view_file.output.safeParse(value);
				if (!parsed.success) continue;
				const item = parsed.data;
				if (item.kind === "file")
					add(
						item.html_url,
						item.path,
						[
							`Lines ${item.offset}–${item.offset + Math.max(0, item.lines - 1)} of ${item.total_lines}`,
							code(item.content),
							item.notice,
							item.truncated ? "Content truncated." : "",
						]
							.filter(Boolean)
							.join("\n\n"),
					);
				else
					for (const entry of item.entries)
						add(
							entry.html_url,
							entry.path,
							`${entry.type}: ${entry.path}\n\n${entry.size} bytes · ${entry.sha}`,
						);
			} else if (
				name === github_list_commits.name ||
				name === github_view_commit.name
			) {
				if (name === github_view_commit.name) {
					const parsed = github_view_commit.output.safeParse(value);
					if (!parsed.success) continue;
					const item = parsed.data;
					commit(item);
					add(
						item.html_url,
						`${item.sha.slice(0, 7)}: ${item.message.split("\n")[0]}`,
						`${item.message}\n\n${item.author.name} · ${item.author.date}\n\n+${item.stats.additions} / -${item.stats.deletions}\n\n${item.files.map((file) => `${file.filename}\n\n${file.patch ? code(file.patch, "diff") : "Patch unavailable."}`).join("\n\n")}`,
					);
					files(item.files);
				} else {
					const parsed = github_list_commits.output.safeParse(value);
					if (parsed.success) commit(parsed.data);
				}
			} else if (name === github_compare.name) {
				const parsed = github_compare.output.safeParse(value);
				if (!parsed.success) continue;
				const item = parsed.data;
				let title = "Comparison";
				try {
					title = decodeURIComponent(
						new URL(item.html_url).pathname.split("/compare/")[1] ?? title,
					);
				} catch {
					/* Keep the fallback for malformed URLs. */
				}
				add(
					item.html_url,
					title,
					`${item.status} · ${item.ahead_by} ahead · ${item.behind_by} behind · ${item.total_commits} commits\n\n${item.commits.map((entry) => entry.message).join("\n\n")}`,
				);
				for (const entry of item.commits) commit(entry);
				files(item.files);
			} else if (name === github_list_issues.name) {
				const parsed = github_list_issues.output.safeParse(value);
				if (parsed.success) issue(parsed.data);
			} else if (name === github_view_issue.name) {
				const parsed = github_view_issue.output.safeParse(value);
				if (!parsed.success) continue;
				const item = parsed.data;
				issue(item.item);
				for (const comment of [
					...item.comments,
					...(item.review_comments ?? []),
				])
					add(
						comment.html_url,
						`#${item.item.number}: Comment by ${comment.author ?? "unknown"}`,
						comment.body,
					);
				files(item.files ?? []);
			}
		}
		return [...sources.values()];
	},
} as const;
