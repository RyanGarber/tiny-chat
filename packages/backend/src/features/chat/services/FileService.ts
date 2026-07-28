import { AgentUtils } from "@tiny-chat/shared/src/features/agent/utils/AgentUtils.ts";
import type { ChatLike } from "@tiny-chat/shared/src/features/data/types/chat.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";
import type {
	FileNode,
	FileState,
} from "@tiny-chat/shared/src/features/file/types/file.ts";
import {
	type PathLike,
	PathUtils,
} from "@tiny-chat/shared/src/features/file/utils/PathUtils.ts";
import { Bash, InMemoryFs, MountableFs } from "just-bash";
import { MessageService } from "../../message/services/MessageService.ts";
import { FileSearchService } from "../../upload/services/FileSearchService.ts";
import { FilesystemService } from "../../upload/services/FilesystemService.ts";
import { ChatService } from "./ChatService.ts";

// TODO WIP
type Instance = { bash: Bash; filesystem: FilesystemService };
const instances = new Map<string, Instance>();

export const FileService = {
	get: async ({
		user,
		chat: _chat,
	}: {
		user: zUser;
		chat: ChatLike;
	}): Promise<Instance> => {
		if (typeof _chat === "string") _chat = { id: _chat };

		if (!instances.has(_chat.id)) {
			console.log(`creating vm for chat: ${_chat.id}`);

			const chat = await ChatService.getChat({ user, chat: _chat });

			const { messages } = await MessageService.getMessages({ user, chat });
			const uploads = AgentUtils.getAllUploadIds({ messages });

			const filesystem = new FilesystemService(user, chat, uploads);
			await filesystem.fetch();

			const bash = new Bash({
				fs: new MountableFs({
					base: new InMemoryFs(),
					mounts: [
						{
							mountPoint: PathUtils.mount,
							filesystem,
						},
					],
				}),
				defenseInDepth: { enabled: true, auditMode: true },
				python: true,
				cwd: PathUtils.mount,
			});

			instances.set(chat.id, {
				filesystem,
				bash,
			});
		}

		const instance = instances.get(_chat.id);
		if (!instance) throw new Error();

		return instance;
	},

	/**
	 * Get a file, with data, in a chat.
	 */
	getFile: async ({
		user,
		chat,
		path,
	}: {
		user: zUser;
		chat: ChatLike;
		path: PathLike;
	}): Promise<FileState> => {
		const { messages } = await MessageService.getMessages({ user, chat });
		const uploads = AgentUtils.getAllUploadIds({ messages });
		const filesystem = new FilesystemService(
			user,
			await ChatService.getChat({ user, chat }),
			uploads,
		);
		await filesystem.fetch();
		const file = await filesystem.getFile(PathUtils.asMount(path) ?? "");
		return {
			...file,
			uri: PathUtils.toMount(file),
		};
	},

	/**
	 * Get the files in a chat.
	 */
	getFiles: async ({
		user,
		chat,
	}: {
		user: zUser;
		chat: ChatLike;
	}): Promise<FileNode[]> => {
		const { filesystem } = await FileService.get({ user, chat });
		return filesystem.nodes;
	},

	getDirectory: async ({
		user,
		chat,
		path,
	}: {
		user: zUser;
		chat: ChatLike;
		path: PathLike;
	}) => {
		const { filesystem } = await FileService.get({ user, chat });
		return await filesystem.readdirWithFileTypes(PathUtils.asMount(path) ?? "");
	},

	/**
	 * Search across all files in a chat.
	 */
	searchFiles: async ({
		user,
		chat,
		searchText,
		searchEmbedding,
		path,
		mode,
		limit = 10,
	}: {
		user: zUser;
		chat: ChatLike;
		searchText: string;
		searchEmbedding?: number[];
		path?: PathLike;
		mode?: "standard" | "grep";
		limit?: number;
	}) => {
		const { filesystem } = await FileService.get({ user, chat });
		return await FileSearchService.searchFiles({
			filesystem,
			searchText,
			searchEmbedding,
			path,
			mode,
			limit,
		});
	},

	writeFile: async ({
		user,
		chat,
		path,
		content,
	}: {
		user: zUser;
		chat: ChatLike;
		path: PathLike;
		content: string;
	}) => {
		const { filesystem } = await FileService.get({ user, chat });
		return await filesystem.writeFile(PathUtils.asMount(path) ?? "", content);
	},

	exec: async ({
		user,
		chat,
		command,
	}: {
		user: zUser;
		chat: ChatLike;
		command: string;
	}) => {
		const { bash } = await FileService.get({ user, chat });
		return await bash.exec(command);
	},
} as const;
