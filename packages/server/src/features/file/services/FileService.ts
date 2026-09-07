import { dirname } from "node:path";
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
import { ChatService } from "../../chat/services/ChatService.ts";
import { FilesystemService } from "./FilesystemService.ts";

type Instance = {
	bash: Bash;
	filesystem: FilesystemService;
	mounts: MountableFs;
};
type Session = {
	instance?: Instance;
	cwd: string;
	env?: Record<string, string>;
	reset: boolean;
	touched: number;
	pending: number;
	queue: Promise<unknown>;
};
const sessions = new Map<string, Session>();
const sessionKey = (user: string, chat: string) => JSON.stringify([user, chat]);
const cleanup = setInterval(() => {
	for (const [key, session] of sessions) {
		if (!session.pending && Date.now() - session.touched > 30 * 60_000)
			sessions.delete(key);
	}
}, 60_000);
cleanup.unref();

export const FileService = {
	cwd: async (options: { user: zUser } & FilesystemSpec): Promise<string> => {
		const result = await FileService.exec({ ...options, command: "pwd" });
		if (!result.stdout)
			throw new Error(result.stderr || "Cannot read chat working directory");
		return result.stdout.replace(/\n$/, "");
	},
	activate: (user: string, chat: string) => {
		const session = sessions.get(sessionKey(user, chat));
		if (session) session.reset = true;
	},
	get: async ({
		user,
		...spec
	}: { user: zUser } & FilesystemSpec): Promise<Instance> => {
		const filesystem = new FilesystemService({ user, ...spec });
		await filesystem.fetch();

		const mounts = new MountableFs({
			base: new InMemoryFs(),
			mounts: [
				{
					mountPoint: `${PathUtils.mount}/`,
					filesystem: filesystem.clone("/"),
				},
			],
		});
		const bash = new Bash({
			fs: mounts,
			defenseInDepth: { enabled: true, auditMode: true },
			python: true,
			cwd: PathUtils.mount,
		});

		return { bash, filesystem, mounts };
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
		const uri = PathUtils.asMount(path);
		if (!uri) throw new Error(`invalid path: ${path}`);
		await filesystem.mkdir(dirname(uri), { recursive: true });
		return await filesystem.writeFile(uri, content);
	},

	exec: async ({
		user,
		command,
		...spec
	}: { user: zUser; command: string } & FilesystemSpec) => {
		if (!spec.chat)
			return (await FileService.get({ user, ...spec })).bash.exec(command);
		const key = sessionKey(user.id, spec.chat);
		let session = sessions.get(key);
		if (!session) {
			session = {
				cwd: PathUtils.mount,
				reset: true,
				touched: Date.now(),
				pending: 0,
				queue: Promise.resolve(),
			};
			sessions.set(key, session);
		}
		const current = session;
		current.pending++;
		const run = current.queue
			.then(async () => {
				// Recheck ownership even when a shell already exists (including deleted chats).
				const folder = await ChatService.getWorkingDirectory({
					user,
					chat: spec.chat,
				});
				const [, , mount, id] = (folder.cwd ?? "").split("/");
				const mounts = {
					...spec,
					uploads: [
						...new Set([
							...(spec.uploads ?? []),
							...(mount === "uploads" && id ? [id] : []),
						]),
					],
					skills: [
						...new Set([
							...(spec.skills ?? []),
							...(mount === "skills" && id ? [id] : []),
						]),
					],
				};
				const filesystem = new FilesystemService({ user, ...mounts });
				await filesystem.fetch();
				if (!current.instance)
					current.instance = await FileService.get({ user, ...mounts });
				else {
					current.instance.mounts.unmount(PathUtils.mount);
					current.instance.mounts.mount(PathUtils.mount, filesystem.clone("/"));
				}
				const { bash } = current.instance;
				if (current.reset) {
					current.reset = false;
					current.cwd = PathUtils.mount;
					if (
						folder.cwd &&
						(folder.cwd === PathUtils.mount ||
							folder.cwd.startsWith(`${PathUtils.mount}/`))
					) {
						try {
							if ((await filesystem.stat(folder.cwd)).isDirectory)
								current.cwd = folder.cwd;
						} catch {
							/* Invalid folder paths fall back to /mnt. */
						}
					}
				}
				try {
					const result = await bash.exec(command, {
						cwd: current.cwd,
						env: current.env ? { ...current.env, PWD: current.cwd } : undefined,
					});
					current.env = result.env;
					if (result.env.PWD) current.cwd = result.env.PWD;
					return result;
				} catch (error) {
					// A filesystem error the shell could not turn into output of its own —
					// a redirect into a read-only tree, most often, since it writes the
					// target before it has anywhere to put the error — is still the
					// command failing rather than the call failing. Report it the way the
					// shell would have.
					console.warn(
						"[FileService] command failed outside the shell:",
						error,
					);
					return {
						code: 1,
						stdout: "",
						stderr: `${error instanceof Error ? error.message : String(error)}\n`,
					};
				}
			})
			.finally(() => {
				current.pending--;
				current.touched = Date.now();
			});
		current.queue = run.catch(() => {});
		return run;
	},
} as const;
