import { useChats } from '@/stores/chats.tsx';
import { useProviders } from '@/stores/providers.tsx';
import { type MessageUnomitted, zMetadata } from '@tiny-chat/core-backend/src/types.ts';
import { generate } from '@/utils/generate';
import { usePersistence } from '@/stores/persistence.tsx';
import type { zGenerateOutput } from '@tiny-chat/core-backend/src/types.ts';

export async function handleMessage(messageId: string) {
  const { currentChat } = useChats.getState();
  if (!currentChat) return;

  const abortController = new AbortController();
  abortController.signal.addEventListener('abort', () => {
    // The abort part will be persisted by the backend
  });
  useProviders.setState({ abortController });

  const stream = generate(
    '/@/generate',
    {
      messageId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userInput: true,
    },
    abortController.signal,
  );

  try {
    await streamIntoReply(stream, false);
  } catch (e: unknown) {
    // @ts-expect-error AbortError check
    if (e.name === 'AbortError') console.warn('Stream aborted');
    else throw e;
  } finally {
    useProviders.setState({ abortController: null });
    await useChats.getState().fetchChat(false);
    await usePersistence.getState().fetchActions();
    await usePersistence.getState().fetchMemories();
  }
}

export async function continueToolCall(
  messageId: string,
  toolCallId: string,
  toolName: string,
  value: unknown,
) {
  const { currentChat } = useChats.getState();
  if (!currentChat) return;

  const abortController = new AbortController();
  useProviders.setState({ abortController });

  const stream = generate(
    '/@/generate/continue',
    {
      messageId,
      toolCallId,
      toolName,
      value,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    abortController.signal,
  );

  try {
    await streamIntoReply(stream, true);
  } catch (e: unknown) {
    // @ts-expect-error AbortError check
    if (e.name === 'AbortError') console.warn('Stream aborted');
    else throw e;
  } finally {
    useProviders.setState({ abortController: null });
    await useChats.getState().fetchChat(false);
    await usePersistence.getState().fetchActions();
    await usePersistence.getState().fetchMemories();
  }
}

/** Stream SSE events into the local reply message for real-time UI updates. */
async function streamIntoReply(stream: AsyncGenerator<zGenerateOutput>, continued: boolean) {
  let reply: MessageUnomitted | null = null;
  let lastFlush = 0;

  const flush = async () => {
    useChats.setState({ messages: [...useChats.getState().messages] });
    await new Promise<void>((r) => setTimeout(r, 0));
    lastFlush = performance.now();
  };

  let hasText = false;
  for await (const event of stream) {
    // Handle the replyId special event — fetch chat to pick up the new message
    if (event.type === 'special' && event.value.type === 'replyId') {
      await useChats.getState().fetchChat(false);
      const replyRef = useChats
        .getState()
        .messages.find(
          (m) => m.id === (event.value as Extract<typeof event.value, { type: 'replyId' }>).value,
        ) as MessageUnomitted;
      if (replyRef) {
        reply = replyRef;
        reply.state.any = true;
        if (!continued) reply.data = [];
        reply.metadata = [];
        useChats.setState({ messages: [...useChats.getState().messages] });
      }
      continue;
    }

    if (!reply) continue; // Shouldn't happen, but guard

    if (event.type === 'data') {
      if (event.value.type === 'text') {
        reply.state.thinking = false;
        reply.state.generating = true;
        if (!hasText) {
          event.value.value = event.value.value.trimStart();
          hasText = true;
        }
        const last = reply.data[reply.data.length - 1];
        if (last?.type === 'text') last.value += event.value.value;
        else reply.data.push(event.value);
      } else if (event.value.type === 'thought') {
        reply.state.thinking = true;
        const last = reply.data[reply.data.length - 1];
        if (last?.type === 'thought' && event.value.continued) last.value += event.value.value;
        else reply.data.push(event.value);
      } else {
        reply.data.push(event.value);
      }
    } else if (event.type === 'special') {
      if (event.value.type === 'metadata') {
        console.log('Received metadata from backend:', event.value.value);
        (reply.metadata as zMetadata[]).push(event.value.value);
      } else if (event.value.type === 'fileUpdate') {
        const fileName = event.value.name;
        const file = reply.data
          .filter((p) => p.type === 'outputFile')
          .find((p) => p.name === fileName);
        if (file) {
          console.log(
            'Updating URL of file:',
            file.name,
            'from URL:',
            file.data,
            'to:',
            event.value.data,
          );
          file.data = event.value.data;
          console.log(
            'Updated file (local):',
            file.data,
            '(global):',
            reply.data.filter((p) => p.type === 'outputFile').find((p) => p.name === fileName)
              ?.data,
          );
        }
      }
    }

    if (performance.now() - lastFlush >= 33) {
      await flush();
    }
  }

  // Final flush
  await flush();
}
