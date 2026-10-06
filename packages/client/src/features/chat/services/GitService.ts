import type {
	GitChange,
	GitRepo,
} from "#client/features/chat/types/chatFiles.ts";
import { GitUtils } from "#client/features/chat/utils/GitUtils.ts";
import type { ShellCapability } from "#core/core/types/capability.ts";
import { FileOperationService } from "#core/features/file/services/FileOperationService.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";

/** Untracked files past this many are listed without counting their lines. */
const MAX_COUNTED = 200;

/** Untracked files larger than this are listed without counting their lines. */
const MAX_COUNTED_BYTES = 1024 * 1024;

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

		const [first, others] = await Promise.all([
			diff("HEAD"),
			shell.exec({
				command: GitUtils.command(
					root,
					"ls-files",
					"--others",
					"--exclude-standard",
					"-z",
				),
			}),
		]);
		// Before the first commit there is no HEAD to compare against.
		const head = first.code === 0;
		const tracked = head ? first : await diff(GitUtils.EMPTY_TREE);

		const paths = GitUtils.paths(others.code === 0 ? others.stdout : "").map(
			(path) => GitUtils.join(root, path),
		);
		const files = await FileOperationService.readFiles({
			shell,
			paths: paths.slice(0, MAX_COUNTED),
			maxBytes: MAX_COUNTED_BYTES,
		});
		const untracked = paths.map((path, index): GitChange => {
			const file = files[index];
			const lines = file ? GitUtils.lines(file.data) : 0;
			return {
				path,
				// A file only partly read has a line count nobody can vouch for.
				additions: file && file.data.length < file.size ? 0 : (lines ?? 0),
				deletions: 0,
				untracked: true,
				binary: lines === null,
			};
		});

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
