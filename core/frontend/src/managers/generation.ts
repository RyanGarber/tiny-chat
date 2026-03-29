import { useChats } from '@/stores/chats.tsx';
import { useProviders } from '@/stores/providers.tsx';
import {
  type MessageOmitted,
  type MessageUnomitted,
  type zConfig,
  zDataPart,
  zMetadata,
} from '@tiny-chat/core-backend/src/types.ts';
import { Author } from '@tiny-chat/core-backend/generated/prisma/enums.ts';
import { generate } from '@/utils/generate';
import { trpc } from '@/utils/api';
import { usePersistence } from '@/stores/persistence.tsx';

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

export function alignToolResults(data: zDataPart[]): zDataPart[] {
  const toolCalls = data.filter((p) => p.type === 'toolCall');
  const results = data.filter((p) => p.type === 'toolResult');

  // Nothing to align
  if (!toolCalls.length || !results.length) return data;

  const sortedResults: zDataPart[] = [];
  const usedResultIndices = new Set<number>();

  // 1. Match results to calls in exact order, consuming them to handle duplicate IDs safely
  for (const call of toolCalls) {
    const matchIndex = results.findIndex((r, i) => r.id === call.id && !usedResultIndices.has(i));
    if (matchIndex !== -1) {
      sortedResults.push(results[matchIndex]);
      usedResultIndices.add(matchIndex);
    }
  }

  // 2. Append any leftover/unmatched results (in case the model hallucinated a result ID)
  results.forEach((r, i) => {
    if (!usedResultIndices.has(i)) sortedResults.push(r);
  });

  // 3. Rebuild the data array strictly in place
  let resultCounter = 0;
  return data.map((part) => {
    if (part.type === 'toolResult') {
      return sortedResults[resultCounter++];
    }
    return part;
  });
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

  // 1. Combine the new result and strictly align the array
  const newData = [
    ...target.data,
    { type: 'toolResult', id: toolCallId, name: toolName, value } as zDataPart,
  ];
  const alignedData = alignToolResults(newData);

  // 2. Count calls vs results
  const toolCallsCount = alignedData.filter((p) => p.type === 'toolCall').length;
  const toolResultsCount = alignedData.filter((p) => p.type === 'toolResult').length;

  // Persist the user selection into the existing assistant message
  await trpc.messages.edit.mutate({
    id: target.id,
    author: target.author,
    config: target.config,
    data: alignedData,
    metadata: targetMetadata,
    truncate: false,
  });

  await useChats.getState().fetchChat(false);

  // 3. If there are still unanswered tools, stop here and wait for the user!
  if (toolResultsCount < toolCallsCount) {
    console.log(`Waiting for more tool inputs (${toolResultsCount}/${toolCallsCount})`);
    return;
  }

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
  abortController.signal.addEventListener('abort', () =>
    reply.data.push({ type: 'abort', reason: 'user' }),
  );
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
  await usePersistence.getState().fetchActions();
  await usePersistence.getState().fetchMemories();
}
