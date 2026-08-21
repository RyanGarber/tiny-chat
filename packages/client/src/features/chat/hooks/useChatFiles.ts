import { useMutation, useQuery } from "@tanstack/react-query";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useConfig } from "../../agent/hooks/useConfig.ts";
import { useMessages } from "../../message/hooks/useMessages.ts";
import { useDraftStore } from "../stores/useDraftStore.ts";
import { useChat } from "./useChat.ts";

const chatFilesQueryKey = ["useChatFiles", "chatFiles"] as const;
const readChatFileMutationKey = ["useChatFiles", "readChatFile"] as const;
const readChatDirectoryMutationKey = [
	"useChatFiles",
	"readChatDirectory",
] as const;

export const useChatFiles = () => {
	const client = useContext(ClientContext);

	const { chat } = useChat();
	const { messages } = useMessages();
	const { config } = useConfig();
	const draftData = useDraftStore((state) => state.data);

	/**
	 * The mount this chat has: the uploads and skills its messages point into,
	 * plus the chat itself to hold what the model wrote.
	 *
	 * The message being written counts too. It hasn't saved it, but its
	 * skills are already chosen and whatever it points into — an attachment,
	 * an upload — is already on the mount, so it is browsable now rather than
	 * only after sending.
	 */
	const filesystem = useMemo(() => {
		const saved = messages.data?.pages.flatMap((page) => page.messages) ?? [];
		const draft: zAgentMessage = {
			id: null,
			author: "USER",
			config,
			data: draftData,
			createdAt: null,
		};
		return {
			chat: chat.data?.id,
			...AgentUtils.getMounts({ messages: [...saved, draft] }),
		};
	}, [chat.data?.id, messages.data?.pages, config, draftData]);

	const chatFiles = useQuery({
		queryKey: [...chatFilesQueryKey, filesystem],
		queryFn: async () => {
			return await client.api.file.getFiles.query(filesystem);
		},
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity,
	});

	const readChatFile = useMutation({
		mutationKey: readChatFileMutationKey,
		mutationFn: async ({
			meta: _meta,
			...options
		}: Pick<Parameters<typeof client.api.file.getFile.query>[0], "path"> & {
			meta?: string;
		}) => {
			return client.api.file.getFile.query({ ...filesystem, ...options });
		},
	});

	const readChatDirectory = useMutation({
		mutationKey: readChatDirectoryMutationKey,
		mutationFn: async (
			options: Pick<
				Parameters<typeof client.api.file.getDirectory.query>[0],
				"path"
			>,
		) => {
			return client.api.file.getDirectory.query({ ...filesystem, ...options });
		},
	});

	return { chatFiles, readChatFile, readChatDirectory, filesystem };
};
