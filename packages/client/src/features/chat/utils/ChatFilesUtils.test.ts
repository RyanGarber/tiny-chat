import type { GitRepo } from "../types/chatFiles.ts";
import { ChatFilesUtils } from "./ChatFilesUtils.ts";

const repo: GitRepo = {
	root: "/work/repo",
	head: true,
	changes: [
		{
			path: "/work/repo/src/a.ts",
			additions: 3,
			deletions: 1,
			untracked: false,
			binary: false,
		},
		{
			path: "/work/repo/src/deep/b.ts",
			additions: 2,
			deletions: 0,
			untracked: true,
			binary: false,
		},
		{
			path: "/work/repo/README.md",
			additions: 0,
			deletions: 4,
			untracked: false,
			binary: false,
		},
	],
};

describe("ChatFilesUtils", () => {
	it("adds up changes below a folder, not beside it", () => {
		expect(
			ChatFilesUtils.changes({ path: "/work/repo/src", repos: [repo] }),
		).toEqual({
			additions: 5,
			deletions: 1,
		});
		expect(
			ChatFilesUtils.changes({ path: "/work/repo", repos: [repo] }),
		).toEqual({
			additions: 5,
			deletions: 5,
		});
		expect(
			ChatFilesUtils.changes({ path: "/work/repo/sr", repos: [repo] }),
		).toBeUndefined();
	});

	it("builds a tree with folders filled in and totals on every local node", () => {
		const tree = ChatFilesUtils.tree({
			files: [
				ChatFilesUtils.local("/work/repo/src", true),
				ChatFilesUtils.local("/work/repo/src/a.ts", false),
				{
					path: "/mnt/chat/x/notes.md",
					directory: false,
					local: false,
					displayPath: ["chat", "notes.md"],
				},
			],
			repos: [repo],
		});
		const [local, mount] = tree;
		expect(local.value).toBe("local:local");
		expect(local.changes).toBeUndefined();
		expect(mount.value).toBe("mount:chat");
		expect(mount.children[0].file?.path).toBe("/mnt/chat/x/notes.md");

		const repoNode = local.children[0].children[0];
		expect(repoNode.label).toBe("repo");
		expect(repoNode.file).toBeUndefined();
		expect(repoNode.changes).toEqual({ additions: 5, deletions: 5 });

		const src = repoNode.children[0];
		expect(src.file?.path).toBe("/work/repo/src");
		expect(src.directory).toBe(true);
		expect(src.changes).toEqual({ additions: 5, deletions: 1 });

		const file = src.children[0];
		expect(file.directory).toBe(false);
		expect(file.changes).toEqual({ additions: 3, deletions: 1 });
	});

	it("names a file's node and its parents the way the tree does", () => {
		const file = ChatFilesUtils.local("/work/repo/src/a.ts", false);
		expect(ChatFilesUtils.node(file)).toEqual({
			value: "local:local/work/repo/src/a.ts",
			parents: [
				"local:local",
				"local:local/work",
				"local:local/work/repo",
				"local:local/work/repo/src",
			],
		});
	});

	it("flattens only what is expanded", () => {
		const tree = ChatFilesUtils.tree({
			files: [ChatFilesUtils.local("/a/b.ts", false)],
		});
		expect(
			ChatFilesUtils.flatten({ nodes: tree, expanded: () => false }).map(
				(row) => row.node.label,
			),
		).toEqual(["local"]);
		expect(
			ChatFilesUtils.flatten({ nodes: tree, expanded: () => true }).map(
				(row) => [row.node.label, row.depth],
			),
		).toEqual([
			["local", 0],
			["a", 1],
			["b.ts", 2],
		]);
	});

	it("keeps the longest read of each web page", () => {
		const page = (content: string) => ({
			data: [
				[
					{
						type: "attachment",
						source: "web:https://x.dev",
						content: { type: "web", title: "X", content },
					},
				],
			],
		});
		expect(
			ChatFilesUtils.webSources({
				messages: [page("short"), page("much longer")] as never,
				toolsets: [],
			}),
		).toEqual([{ url: "https://x.dev", title: "X", content: "much longer" }]);
	});
});
