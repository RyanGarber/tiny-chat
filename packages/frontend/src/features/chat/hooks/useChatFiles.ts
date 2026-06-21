import { useMutation, useQuery } from '@tanstack/react-query';
import { useChat } from '@/features/chat/hooks/useChat.ts';
import { trpc } from '@/utils/api.ts';
import { useMessages } from '@/features/message/hooks/useMessages.ts';

export const chatFilesQueryKey = ['chat-files'] as const;
export const chatFileDataQueryKey = ['chat-file-data'] as const;

export const useChatFiles = () => {
  const { chat } = useChat();
  const messages = useMessages();

  const chatFiles = useQuery({
    queryKey: [
      ...chatFilesQueryKey,
      ...(messages.data?.pages.flatMap(({ messages }) =>
        messages.flatMap((m) =>
          m.data
            .flat()
            .flatMap((part) =>
              part.type === 'upload' || (part.type === 'toolResult' && part.name === 'write_file')
                ? [part.id]
                : [],
            ),
        ),
      ) ?? []),
    ],
    queryFn: async () => {
      if (!chat.data?.id) return {};
      return await trpc.input.listAllFilesInChat.query({ chatId: chat.data?.id });
    },
    refetchInterval: Infinity,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const loadChatFileData = useMutation({
    mutationKey: chatFileDataQueryKey,
    mutationFn: async (
      options: Parameters<typeof trpc.input.findFileInChat.query>[0] & { reason: string },
    ) => {
      return trpc.input.findFileInChat.query(options);
    },
  });

  return { chatFiles, loadChatFileData };
};
