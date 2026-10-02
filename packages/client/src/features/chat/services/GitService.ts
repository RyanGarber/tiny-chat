import type { ShellCapability } from "@tiny-chat/core/core/types/capability.ts";
import { PathUtils } from "@tiny-chat/core/features/file/utils/PathUtils.ts";
import type { GitChange, GitRepo } from "../types/chatFiles.ts";
import { GitUtils } from "../utils/GitUtils.ts";

/** Untracked files past this many are listed without counting their lines. */
const MAX_COUNTED = 200;

/** `exec` keeps this much of a command's output before it starts dropping some. */
const MAX_OUTPUT = 256 * 1024;

/**
 * Directories already found to be in a repository, by the root they are in.
 * Ones that are not are asked again next time, since a repository can be
 * started in them at any point.
 */
const roots = new Map<string, string>();

export const GitService = {
	/** The repository a directory is in, if any. */
	root: async ({
		shell,
		directory,
	}: {
		shell: ShellCapability;
		directory: string;
	}) => {
		const cached = roots.get(directory);
		if (cached) return cached;
		const result = await shell.exec({
			command: GitUtils.command(directory, "rev-parse", "--show-prefix"),
		});
		if (result.code !== 0) return null;
		const root = GitUtils.root({ directory, prefix: result.stdout });
		if (root) roots.set(directory, root);
		return root;
	},

	/**
	 * The repositories a set of directories are in. A directory inside a root
	 * already found is not asked about, which keeps a folder that has been
	 * opened a few levels deep down to a single `git` call.
	 */
	roots: async ({
		shell,
		directories,
	}: {
		shell: ShellCapability;
		directories: string[];
	}) => {
		const found: string[] = [];
		const sorted = [
			...new Set(
				directories.map((directory) =>
					PathUtils.normalize({ path: directory, unix: true }),
				),
			),
		].sort((a, b) => a.length - b.length);
		for (const directory of sorted) {
			if (
				found.some(
					(root) =>
						PathUtils.equals(root, directory) ||
						PathUtils.contains({ parent: root, descendent: directory }),
				)
			)
				continue;
			const root = await GitService.root({ shell, directory }).catch(
				() => null,
			);
			if (root && !found.includes(root)) found.push(root);
		}
		return found;
	},

	/** Everything in the working tree that differs from the last commit. */
	status: async ({
		shell,
		root,
	}: {
		shell: ShellCapability;
		root: string;
	}): Promise<GitRepo> => {
		const diff = (base: string) =>
			shell.exec({
				command: GitUtils.command(
					root,
					"diff",
					base,
					"--numstat",
					"--no-renames",
					"-z",
				),
			});

		let head = true;
		let tracked = await diff("HEAD");
		if (tracked.code !== 0) {
			head = false;
			tracked = await diff(GitUtils.EMPTY_TREE);
		}

		const others = await shell.exec({
			command: GitUtils.command(
				root,
				"ls-files",
				"--others",
				"--exclude-standard",
				"-z",
			),
		});
		const untracked = await Promise.all(
			GitUtils.paths(others.code === 0 ? others.stdout : "").map(
				async (path, index): Promise<GitChange> => {
					const absolute = GitUtils.join(root, path);
					const lines =
						index < MAX_COUNTED
							? await shell
									.readFile({ path: absolute })
									.then(({ data }) => GitUtils.lines(data))
									.catch(() => 0)
							: 0;
					return {
						path: absolute,
						additions: lines ?? 0,
						deletions: 0,
						untracked: true,
						binary: lines === null,
					};
				},
			),
		);

		return {
			root,
			head,
			changes: [
				...GitUtils.numstat({
					root,
					output: tracked.code === 0 ? tracked.stdout : "",
				}),
				...untracked,
			],
		};
	},

	/**
	 * A file as it was at the last commit: empty for one that is new since, and
	 * null for one too large to have been read whole.
	 */
	original: async ({
		shell,
		repo,
		change,
	}: {
		shell: ShellCapability;
		repo: GitRepo;
		change: GitChange;
	}) => {
		if (change.untracked || !repo.head) return "";
		const path = PathUtils.relative({ base: repo.root, path: change.path });
		const result = await shell.exec({
			command: GitUtils.command(
				repo.root,
				"cat-file",
				"blob",
				GitUtils.quote(`HEAD:${path}`),
			),
		});
		if (result.code !== 0) return "";
		if (result.stdout.length >= MAX_OUTPUT) return null;
		return result.stdout;
	},
} as const;
