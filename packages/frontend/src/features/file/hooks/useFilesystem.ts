import { useMutation, useQuery } from "@tanstack/react-query";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { useMessages } from "#frontend/features/message/hooks/useMessages.ts";
import { trpc } from "#frontend/utils/api.ts";

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
			return await trpc.file.getFiles.query({
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
			options: Parameters<typeof trpc.file.getFile.query>[0] & {
				meta: string;
			},
		) => {
			return trpc.file.getFile.query(options);
		},
	});

	return { chatFiles, readChatFile };
};
