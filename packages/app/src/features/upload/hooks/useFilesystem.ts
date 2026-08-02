import { useMutation, useQuery } from "@tanstack/react-query";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { useMessages } from "#client/src/features/chat/hooks/useMessages.ts";
import { client } from "#ui/client.ts";

const chatFilesQueryKey = ["chat-files"] as const;
const chatFileDataQueryKey = ["chat-file-data"] as const;

export const useFilesystem = () => {
	const { chat } = useChat();
	const { messages } = useMessages();

	const chatFiles = useQuery({
		queryKey: [
			...chatFilesQueryKey,
			chat.data?.id,
			...(messages.data?.pages.flatMap(({ messages }) =>
				messages.flatMap((m) =>
					m.data
						.flat()
						.flatMap((part) =>
							part.type === "upload" ||
							(part.type === "toolResult" && part.name === "write_file")
								? [part.id]
								: [],
						),
				),
			) ?? []),
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
		mutationKey: chatFileDataQueryKey,
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
