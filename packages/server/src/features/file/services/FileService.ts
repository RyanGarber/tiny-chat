import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import type {
	FileNode,
	FileState,
	FilesystemSpec,
} from "@tiny-chat/core/src/features/file/types/file.ts";
import {
	type PathLike,
	PathUtils,
} from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { Bash, InMemoryFs, MountableFs } from "just-bash";
import { FilesystemService } from "./FilesystemService.ts";

type Instance = { bash: Bash; filesystem: FilesystemService };

export const FileService = {
	// TODO - instance caching
	//  for now, uncached: a filesystem is built from the messages that point
	//  into it, so it changes underneath any key we would cache it by
	get: async ({
		user,
		...spec
	}: { user: zUser } & FilesystemSpec): Promise<Instance> => {
		const filesystem = new FilesystemService({ user, ...spec });
		await filesystem.fetch();

		const bash = new Bash({
			fs: new MountableFs({
				base: new InMemoryFs(),
				mounts: [
					{
						mountPoint: `${PathUtils.mount}/`,
						filesystem: filesystem.clone("/"),
					},
				],
			}),
			defenseInDepth: { enabled: true, auditMode: true },
			python: true,
			// Start in the one place that can be written to, so relative work
			// lands there rather than bouncing off a read-only tree.
			cwd: spec.chat
				? PathUtils.toMount({ mount: "chat", id: spec.chat })
				: PathUtils.mount,
		});

		return { bash, filesystem };
	},

	/**
	 * Get a file, with data, on the mount.
	 */
	getFile: async ({
		user,
		path,
		...spec
	}: { user: zUser; path: PathLike } & FilesystemSpec): Promise<FileState> => {
		const { filesystem } = await FileService.get({ user, ...spec });
		const uri = PathUtils.asMount(path) ?? "";
		return { ...(await filesystem.getFile(uri)), uri };
	},

	/**
	 * Get every file on the mount.
	 */
	getFiles: async ({
		user,
		...spec
	}: { user: zUser } & FilesystemSpec): Promise<FileNode[]> => {
		const { filesystem } = await FileService.get({ user, ...spec });
		return filesystem.getAllNodes();
	},

	getDirectory: async ({
		user,
		path,
		...spec
	}: { user: zUser; path: PathLike } & FilesystemSpec) => {
		const { filesystem } = await FileService.get({ user, ...spec });
		return await filesystem.readdirWithFileTypes(
			PathUtils.asMount(path) ?? PathUtils.mount,
		);
	},

	writeFile: async ({
		user,
		path,
		content,
		...spec
	}: { user: zUser; path: PathLike; content: string } & FilesystemSpec) => {
		const { filesystem } = await FileService.get({ user, ...spec });
		return await filesystem.writeFile(PathUtils.asMount(path) ?? "", content);
	},

	exec: async ({
		user,
		command,
		...spec
	}: { user: zUser; command: string } & FilesystemSpec) => {
		const { bash } = await FileService.get({ user, ...spec });
		try {
			return await bash.exec(command);
		} catch (error) {
			// A filesystem error the shell could not turn into output of its own —
			// a redirect into a read-only tree, most often, since it writes the
			// target before it has anywhere to put the error — is still the
			// command failing rather than the call failing. Report it the way the
			// shell would have.
			console.warn("[FileService] command failed outside the shell:", error);
			return {
				code: 1,
				stdout: "",
				stderr: `${error instanceof Error ? error.message : String(error)}\n`,
			};
		}
	},
} as const;
