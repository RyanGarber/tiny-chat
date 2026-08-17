import { useMutation, useQuery } from "@tanstack/react-query";
import type { zAgentMessage } from "@tiny-chat/core/src/features/agent/types/agent.ts";
import { AgentUtils } from "@tiny-chat/core/src/features/agent/utils/AgentUtils.ts";
import { useContext, useMemo } from "react";
import { ClientContext } from "../../../client.ts";
import { useConfig } from "../../agent/hooks/useConfig.ts";
import { useMessages } from "../../message/hooks/useMessages.ts";
import { useChat } from "./useChat.ts";

const chatFilesQueryKey = ["useChatFiles", "chatFiles"] as const;
const readChatFileQueryKey = ["useChatFiles", "readChatFile"] as const;

export const useChatFiles = () => {
	const client = useContext(ClientContext);

	const { chat } = useChat();
	const { messages } = useMessages();
	const { config } = useConfig();

	/**
	 * The mount this chat has: the uploads and skills its messages point into,
	 * plus the chat itself to hold what the model wrote.
	 *
	 * The message being written counts too. Nothing has saved it yet, but its
	 * skills are already chosen, and they are on the mount for what is about to
	 * be sent — so they are browsable now rather than only after sending.
	 */
	const filesystem = useMemo(() => {
		const saved = messages.data?.pages.flatMap((page) => page.messages) ?? [];
		const draft: zAgentMessage = {
			id: null,
			author: "USER",
			config,
			data: [],
			createdAt: null,
		};
		return {
			chat: chat.data?.id,
			...AgentUtils.getMounts({ messages: [...saved, draft] }),
		};
	}, [chat.data?.id, messages.data?.pages, config]);

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
		mutationKey: readChatFileQueryKey,
		mutationFn: async ({
			meta: _meta,
			...options
		}: Omit<
			Parameters<typeof client.api.file.getFile.query>[0],
			"chat" | "uploads" | "skills"
		> & { meta: string }) => {
			return client.api.file.getFile.query({ ...filesystem, ...options });
		},
	});

	return { chatFiles, readChatFile, filesystem };
};
