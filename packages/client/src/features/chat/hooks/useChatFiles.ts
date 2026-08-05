import { useMutation, useQuery } from "@tanstack/react-query";
import { edit_file } from "@tiny-chat/core/src/features/tool/tools/shell/edit_file.ts";
import { write_file } from "@tiny-chat/core/src/features/tool/tools/shell/write_file.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { useContext } from "react";
import { ClientProvider } from "../../../client.ts";
import { useTools } from "../../agent/hooks/useTools.ts";
import { useChat } from "./useChat.ts";
import { useMessages } from "./useMessages.ts";

const chatFilesQueryKey = ["useChatFiles", "chatFiles"] as const;
const readChatFileQueryKey = ["useChatFiles", "readChatFile"] as const;

export const useChatFiles = () => {
	const client = useContext(ClientProvider);

	const { chat } = useChat();
	const { messages } = useMessages();
	const { toolsets } = useTools();

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
							(part.type === "toolResult" &&
								(ToolUtils.is({ toolsets, part, isTool: write_file }) ||
									ToolUtils.is({ toolsets, part, isTool: edit_file })))
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
