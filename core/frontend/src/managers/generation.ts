import { useChats } from '@/stores/chats.tsx';
import { useProviders } from '@/stores/providers.tsx';
import {
  type MessageOmitted,
  type MessageUnomitted,
  type zConfig,
  zMetadata,
} from '@tiny-chat/core-backend/src/types.ts';
import { Author } from '@tiny-chat/core-backend/generated/prisma/enums.ts';
import { generate } from '@/utils/generate';
import { trpc } from '@/utils/api';

export async function handleMessage(messageId: string) {
  const { currentChat, messages } = useChats.getState();
  if (!currentChat) return;

  const config = messages.find((m) => m.id === messageId)!.config;
  console.log('Running model with config:', config);

  let isPostTarget = false;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].author !== Author.USER) continue;

    const isTarget = messages[i].id === messageId;
    if (isTarget) isPostTarget = true;

    if (isPostTarget) {
      const reply = await prepare(messages[i].id, config);

      reply.state.any = true;
      useChats.setState({ messages: useChats.getState().messages });
      console.log(
        `Replying to message ${messages[i].id} using ${isTarget ? 'config' : 'its existing settings'}`,
        reply.config,
      );

      await runGeneration({
        reply,
        context: messages.slice(0, i + 1),
        config,
      });
    }
  }
}

export async function continueToolCall(
  messageId: string,
  toolCallId: string,
  toolName: string,
  value: unknown,
) {
  const { currentChat, messages } = useChats.getState();
  if (!currentChat) return;

  const targetIndex = messages.findIndex((m) => m.id === messageId);
  if (targetIndex < 0) return;
  const target = messages[targetIndex];
  if (target.author !== Author.MODEL) return;

  const hasMatchingCall = target.data.some(
    (p) => p.type === 'toolCall' && p.id === toolCallId && p.name === toolName,
  );
  if (!hasMatchingCall) return;

  const alreadyAnswered = target.data.some(
    (p) => p.type === 'toolResult' && p.id === toolCallId && p.name === toolName,
  );
  if (alreadyAnswered) return;

  const omissions = await trpc.messages.listOmissions.query({ ids: messages.map((m) => m.id) });
  const targetMetadata = zMetadata.parse(omissions.get(target.id)?.metadata);

  // Persist the user selection into the existing assistant message before resuming generation.
  await trpc.messages.edit.mutate({
    id: target.id,
    author: target.author,
    config: target.config,
    data: [...target.data, { type: 'toolResult', id: toolCallId, name: toolName, value }],
    metadata: targetMetadata,
    truncate: false,
  });

  await useChats.getState().fetchChat(false);

  const reply = useChats.getState().messages.find((m) => m.id === target.id) as MessageUnomitted;
  reply.metadata = targetMetadata;
  reply.state.any = true;
  reply.state.thinking = false;
  useChats.setState({ messages: [...useChats.getState().messages] });

  const refreshedMessages = useChats.getState().messages;
  const refreshedIndex = refreshedMessages.findIndex((m) => m.id === target.id);
  if (refreshedIndex < 0) return;

  await runGeneration({
    reply,
    context: refreshedMessages.slice(0, refreshedIndex + 1),
    config: reply.config,
  });
}

async function runGeneration({
  reply,
  context,
  config,
}: {
  reply: MessageUnomitted;
  context: MessageOmitted[];
  config: zConfig;
}) {
  const abortController = new AbortController();
  abortController.signal.addEventListener('abort', () => reply.data.push({ type: 'abort' }));
  useProviders.setState({ abortController });

  const stream = generate(
    {
      context: context.map((m) => ({ id: m.id, author: m.author, data: m.data })),
      config,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userInput: true,
    },
    abortController.signal,
  );

  let lastFlush = 0;
  const flush = async () => {
    useChats.setState({ messages: [...useChats.getState().messages] });
    await new Promise<void>((r) => setTimeout(r, 0));
    lastFlush = performance.now();
  };

  let error: unknown = null;

  try {
    let hasText = false;
    for await (const event of stream) {
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
        } else {
          reply.data.push(event.value);
          if (event.value.type === 'thought') {
            reply.state.thinking = true;
          }
        }
      } else if (event.type === 'special') {
        if (event.value.type === 'metadata') {
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
              file.url,
              'to:',
              event.value.url,
            );
            file.url = event.value.url;
            console.log(
              'Updated file (local):',
              file.url,
              '(global):',
              reply.data.filter((p) => p.type === 'outputFile').find((p) => p.name === fileName)
                ?.url,
            );
          }
        }
      }

      if (performance.now() - lastFlush >= 33) {
        await flush();
      }
    }
  } catch (e: unknown) {
    // @ts-expect-error ts is fucking stupid
    if (e.name === 'AbortError') console.warn('Stream aborted');
    else error = e;
  } finally {
    useProviders.setState({ abortController: null });

    await flush();
    await publish(reply);
    console.log('Published reply:', reply);
  }
  if (error) throw error as Error;
}

async function prepare(previousId: string, config: zConfig): Promise<MessageUnomitted> {
  const messages = useChats.getState().messages;
  const existing = messages.find((m) => m.previousId === previousId);
  const reply = !existing
    ? await trpc.messages.create.mutate({
        chatId: messages[0].chatId,
        previousId: previousId,
        author: Author.MODEL,
        config: config,
        data: [],
        metadata: [],
      })
    : await trpc.messages.edit.mutate({
        id: existing.id,
        author: existing.author,
        config: existing.config,
        data: [],
        metadata: [],
        truncate: false,
      });
  await useChats.getState().fetchChat(false);
  const replyRef = useChats.getState().messages.find((m) => m.id === reply.id) as MessageUnomitted;
  replyRef.metadata = [];
  return replyRef;
}

async function publish(prepared: MessageUnomitted) {
  await trpc.messages.edit.mutate({
    id: prepared.id,
    author: prepared.author,
    config: prepared.config,
    data: prepared.data,
    metadata: prepared.metadata,
    truncate: false,
  });
  await useChats.getState().fetchChat(false);
}
