import { useQueries, useQuery } from "@tanstack/react-query";
import { useCallback, useContext, useMemo, useState } from "react";
import { ClientContext } from "#client/client.ts";
import { useTools } from "#client/features/agent/hooks/useTools.ts";
import { useChatFiles } from "#client/features/chat/hooks/useChatFiles.ts";
import { GitService } from "#client/features/chat/services/GitService.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useDraftStore } from "#client/features/chat/stores/useDraftStore.ts";
import type {
	ChatFile,
	GitRepo,
} from "#client/features/chat/types/chatFiles.ts";
import { ChatFilesUtils } from "#client/features/chat/utils/ChatFilesUtils.ts";
import { useMessages } from "#client/features/message/hooks/useMessages.ts";

/** How often a repository is asked what changed, while its files are shown. */
const GIT_INTERVAL = 5000;

// Kept outside the hook so the list only changes when a status does.
const combine = (results: { data?: GitRepo }[]) =>
	results.flatMap((result) => (result.data ? [result.data] : []));

/**
 * Everything the chat's files panel shows: the files the chat has touched as
 * a tree, the web pages it has read, and, for files on the machine, the git
 * repositories they are in and what has changed in them.
 *
 * Folders on the machine are read only once they are opened, through
 * `loadDirectory`.
 */
export const useChatFileTree = () => {
	const client = useContext(ClientContext);
	const shell = client.shell;

	const { chatFiles } = useChatFiles();
	const { messages } = useMessages();
	const { toolsets } = useTools();
	const draftData = useDraftStore((state) => state.data);
	const chatId = useChatStore((state) => state.chatId);

	const [loaded, setLoaded] = useState<{
		chatId: string | null;
		files: ChatFile[];
	}>({ chatId, files: [] });
	const [loading, setLoading] = useState<Set<string>>(() => new Set());

	const messageList = useMemo(
		() => messages.data?.pages.flatMap((page) => page.messages) ?? [],
		[messages.data],
	);

	const files = useMemo(
		() =>
			ChatFilesUtils.files({
				mounted: chatFiles.data ?? [],
				messages: messageList,
				draft: { data: draftData },
				loaded: loaded.chatId === chatId ? loaded.files : [],
				toolsets,
			}),
		[chatFiles.data, messageList, draftData, loaded, chatId, toolsets],
	);

	const webSources = useMemo(
		() =>
			ChatFilesUtils.webSources({
				messages: [...messageList, { data: draftData }],
				toolsets,
			}),
		[messageList, draftData, toolsets],
	);

	// Every folder a file on the machine is in, which is where git is asked.
	const directories = useMemo(
		() =>
			[
				...new Set(
					files
						.filter((file) => file.local)
						.map((file) =>
							file.directory
								? file.path
								: file.path.slice(0, file.path.lastIndexOf("/")) || "/",
						),
				),
			].sort(),
		[files],
	);

	const roots = useQuery({
		queryKey: ["useChatFileTree", "roots", directories],
		queryFn: () =>
			shell ? GitService.roots({ shell, directories }) : Promise.resolve([]),
		enabled: !!shell && directories.length > 0,
		staleTime: Number.POSITIVE_INFINITY,
		placeholderData: (previous) => previous,
	});

	const repos = useQueries({
		queries: (roots.data ?? []).map((root) => ({
			queryKey: ["useChatFileTree", "status", root],
			queryFn: () =>
				shell
					? GitService.status({ shell, root })
					: Promise.reject(new Error("local files not available")),
			enabled: !!shell,
			refetchInterval: GIT_INTERVAL,
			refetchOnWindowFocus: true,
		})),
		combine,
	});

	const tree = useMemo(
		() => ChatFilesUtils.tree({ files, repos }),
		[files, repos],
	);

	const loadDirectory = useCallback(
		(directory: ChatFile) => {
			const key = `${chatId}:${directory.path}`;
			if (!shell || !directory.local || loading.has(key)) return;
			setLoading((current) => new Set(current).add(key));
			void shell
				.readDir({ path: directory.path })
				.then((entries) => {
					setLoaded((current) => ({
						chatId,
						files: [
							...(current.chatId === chatId ? current.files : []),
							...entries.map((entry) =>
								ChatFilesUtils.local(entry.path, entry.is_dir),
							),
						],
					}));
				})
				.catch((error) => {
					console.warn("Failed to read local directory", error);
					setLoading((current) => {
						const next = new Set(current);
						next.delete(key);
						return next;
					});
				});
		},
		[shell, chatId, loading],
	);

	return {
		chatFiles,
		files,
		tree,
		webSources,
		repos,
		loadDirectory,
	};
};
