import { useChats } from '@/stores/chats.tsx';
import { useMessaging } from '@/stores/messaging.tsx';
import { useProviders } from '@/stores/providers.tsx';
import { useLayout } from '@/stores/layout.tsx';
import { useTasks } from '@/stores/tasks.tsx';
import { reloadConfig } from '@/managers/configuration';
import { trpc } from '@/utils/api';
import { extractText, scrubText } from '@/utils/text';
import { alert } from '@/utils/ui';
import { type zData } from '@tiny-chat/core-backend/src/types.ts';
import { Author } from '@tiny-chat/core-backend/generated/prisma/enums.ts';
import { handleMessage } from '@/managers/generation';

function setInputDisabled(disabled: boolean) {
  const { isMessagingDisabled, setMessagingDisabled } = useLayout.getState();
  if (isMessagingDisabled === disabled) return;
  setMessagingDisabled(disabled);
}

export async function sendMessage(data: zData) {
  const { config, truncating, reset, editing, setData } = useMessaging.getState();
  const { setCurrentChat, fetchFolders, fetchChat, temporary, incognito } = useChats.getState();
  let currentChat = useChats.getState().currentChat;
  if (!config) return;

  useTasks.getState().addTask('sending', 'Preparing message');
  setInputDisabled(true);
  reset();
  // Clear chat-level flags that reset() used to handle via cross-store call
  useChats.setState({ temporary: false, incognito: false });

  let message;
  try {
    if (editing) {
      console.log(`Editing message ${editing.id} (truncate: ${truncating}):`, data);
      message = await trpc.messages.edit.mutate({
        id: editing.id,
        author: editing.author,
        config,
        data,
        metadata: [],
        truncate: truncating,
      });
    } else {
      console.log(
        `Sending message in ${currentChat?.id ?? 'new chat'}:`,
        data,
        'temporary:',
        temporary,
      );
      message = await trpc.messages.create.mutate({
        chatId: currentChat?.id,
        author: Author.USER,
        config,
        data,
        metadata: [],
        previousId: useMessaging.getState().insertingAfter?.id,
        temporary,
        incognito,
      });
    }
    await fetchFolders(false);
    if (!currentChat) await setCurrentChat(message.chatId, true, false);
    else await fetchChat(false);
  } catch (e) {
    alert('error', 'Failed to create message');
    if (message) await deleteMessagePair(message.id);
    setData(data);
    throw e; // rethrow for logging
  }

  reloadConfig();
  currentChat = useChats.getState().currentChat!;

  if (!currentChat.title) {
    console.log('Chat has no title; setting one');
    void (async () => {
      await trpc.chats.edit.mutate({
        id: currentChat.id,
        title: scrubText(extractText(data), 100),
      });
      await fetchFolders(false);
    })();
  }

  void useTasks.getState().removeTask('sending');

  try {
    console.log(`Running model ${useMessaging.getState().config!.model} on message ${message.id}`);
    await handleMessage(message.id);
  } catch (e) {
    alert('error', 'Failed to run model');
    await deleteMessagePair(message.id);
    setData(data);
    throw e; // rethrow for logging
  } finally {
    setInputDisabled(false);
    useProviders.setState({ abortController: null });
  }
}

export async function deleteMessagePair(messageId: string) {
  setInputDisabled(true);
  useTasks.getState().addTask('deleteMessagePair', 'Deleting message');
  await trpc.messages.delete.mutate({ id: messageId });
  void useTasks.getState().updateTask('deleteMessagePair', 33);
  await useChats.getState().fetchFolders(false);
  void useTasks.getState().updateTask('deleteMessagePair', 66);
  await useChats.getState().fetchChat(false);
  await useTasks.getState().removeTask('deleteMessagePair');
  setInputDisabled(false);
}
