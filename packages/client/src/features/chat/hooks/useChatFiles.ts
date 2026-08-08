import { useMutation, useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { ClientContext } from "../../../client.ts";
import { useMessages } from "../../message/hooks/useMessages.ts";
import { useChat } from "./useChat.ts";

const chatFilesQueryKey = ["useChatFiles", "chatFiles"] as const;
const readChatFileQueryKey = ["useChatFiles", "readChatFile"] as const;

export const useChatFiles = () => {
	const client = useContext(ClientContext);

	const { chat } = useChat();
	const { messages } = useMessages();

	const chatFiles = useQuery({
		queryKey: [
			...chatFilesQueryKey,
			chat.data?.id,
			messages.data?.pages
				.flatMap((page) => page.messages)
				.flatMap((message) => message.data)
				.flat()
				.map((part) => part.type)
				.join(),
		],
		queryFn: async () => {
			if (!chat.data?.id) return [];
			return await client.api.file.getFiles.query({
				chat: chat.data.id,
			});
		},
		refetchInterval: Infinity,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
	});

	const readChatFile = useMutation({
		mutationKey: readChatFileQueryKey,
		mutationFn: async (
			options: Parameters<typeof client.api.file.getFile.query>[0] & {
				meta: string;
			},
		) => {
			return client.api.file.getFile.query(options);
		},
	});

	return { chatFiles, readChatFile };
};
