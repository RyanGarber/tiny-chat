import { useChats } from '@/managers/chats.tsx';
import { reloadConfig } from '@/managers/messaging.tsx';
import { create } from 'zustand';
import { format } from 'timeago.js';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  ChatProviderStatus,
  MessageUnomitted,
  SearchProviderStatus,
  zConfig,
  zData,
  zDataPart,
  zMetadata,
} from '@tiny-chat/core-backend/src/types.ts';
import { extractText, generate, trpc } from '@/utils.ts';
import { useSettings } from '@/managers/settings.tsx';
import { Author } from '@tiny-chat/core-backend/generated/prisma/enums.ts';
import { useTasks } from '@/managers/tasks.tsx';

interface Providers {
  init: () => Promise<void>;

  chatProviders: ChatProviderStatus[];
  searchProviders: SearchProviderStatus[];
  updateProviders: () => Promise<void>;

  abortController: AbortController | null;
  handleMessage: (messageId: string) => Promise<void>;
  continueToolCall: (
    messageId: string,
    toolCallId: string,
    toolName: string,
    value: unknown,
  ) => Promise<void>;
}

export const useProviders = create(
  subscribeWithSelector<Providers>((set, get) => ({
    init: async () => {
      await get().updateProviders();
    },

    chatProviders: [],
    searchProviders: [],
    updateProviders: async () => {
      useTasks.getState().addTask('providers', 'Checking availability');

      const providers = await trpc.providers.listProviders.query();
      const chatProviderModels = providers.chat.reduce((acc, s) => acc + s.models.length, 0);
      void useTasks
        .getState()
        .updateTask(
          'providers',
          100,
          `Found ${chatProviderModels} model${chatProviderModels === 1 ? '' : 's'}`,
          'Finding models',
        );

      console.log('Updated providers:', providers);
      set({ chatProviders: providers.chat, searchProviders: providers.search });
      reloadConfig();

      void useTasks.getState().removeTask('providers');
    },

    abortController: null,
    handleMessage: async (messageId: string) => {
      const { currentChat, messages } = useChats.getState();
      if (!currentChat) return;

      const config = messages.find((m) => m.id === messageId)!.config;
      console.log('Running model with config:', config);

      const omissions = await trpc.messages.listOmissions.query({ ids: messages.map((m) => m.id) });

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

          const { context, instructions } = await buildGenerationInput({
            chat: currentChat,
            messages,
            endIndex: i,
            omissions,
            modelName: reply.config.model,
          });

          console.log(
            'Using instructions:',
            instructions,
            'context:',
            context,
            'and args:',
            config.args,
          );
          await runGeneration({
            reply,
            instructions,
            context,
            config,
          });
        }
      }
    },

    continueToolCall: async (messageId, toolCallId, toolName, value) => {
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

      const reply = useChats
        .getState()
        .messages.find((m) => m.id === target.id) as MessageUnomitted;
      reply.metadata = targetMetadata;
      reply.state.any = true;
      reply.state.thinking = false;
      useChats.setState({ messages: [...useChats.getState().messages] });

      const refreshedMessages = useChats.getState().messages;
      const refreshedIndex = refreshedMessages.findIndex((m) => m.id === target.id);
      if (refreshedIndex < 0) return;

      const { context, instructions } = await buildGenerationInput({
        chat: currentChat,
        messages: refreshedMessages,
        endIndex: refreshedIndex,
        omissions,
        modelName: reply.config.model,
      });

      await runGeneration({
        reply,
        instructions,
        context,
        config: reply.config,
      });
    },
  })),
);

async function buildGenerationInput({
  chat: chat,
  messages,
  endIndex,
  omissions,
  modelName,
}: {
  chat: NonNullable<ReturnType<typeof useChats.getState>['currentChat']>;
  messages: ReturnType<typeof useChats.getState>['messages'];
  endIndex: number;
  omissions: Map<string, { metadata: zMetadata }>;
  modelName: string;
}) {
  // TODO - chat and messages are probably always up-to-date, why pass into here?
  // TODO - but also, maybe should move toward being able to change chats mid-generation and have things not break

  const memories = chat.incognito
    ? []
    : await trpc.embeddings.getMemoryContext.mutate({
        context: messages
          .slice(0, endIndex + 1)
          .filter((m) => m.author === Author.USER)
          .slice(-4)
          .map((m) => m.id),
      });

  const actions = await trpc.actions.list.query({ chatId: chat.id });

  const context: MessageUnomitted[] = messages.slice(0, endIndex + 1).map((m, i) => {
    let isFirstText = true;
    let fileNumber = 1;
    return {
      ...m,
      metadata: zMetadata.parse(omissions.get(m.id)?.metadata),
      data: m.data.flatMap((d): zDataPart[] => {
        if (d.type === 'file') {
          return [{ type: 'text', value: `Attached file #${fileNumber++} (${d.name}):` }, d];
        }
        if (d.type === 'text') {
          let value = d.value.replace(/((?:^::>:: .*$\n?)+)/gm, (block) => {
            const lines = block
              .trim()
              .split('\n')
              .map((l) => l.replace(/^::>:: /, ''));
            let referencedModel = '';
            let contentLines = lines;
            if (lines[0].startsWith('::model=') && lines[0].endsWith('::')) {
              referencedModel = lines[0].slice('::model='.length, -2);
              contentLines = lines.slice(1);
            }
            const prefix = referencedModel ? `Earlier, ${referencedModel} said:\n` : '';
            return prefix + contentLines.map((l) => `> ${l}`).join('\n') + '\n';
          });
          if (isFirstText) {
            let heading;
            if (m.author === Author.USER) {
              heading = `[user]\n`;
              if (i !== 0) {
                const delay = format(messages[i - 1].createdAt, undefined, {
                  relativeDate: m.createdAt,
                }).replace(' ago', '');
                if (delay !== 'just now') {
                  heading += `[Conversation timing: ${delay} ${delay.endsWith('s') ? 'have' : 'has'} passed since the last message.]\n`;
                }
              }
            } else {
              heading = `[assistant:model=${m.config.model}]\n`;
            }
            value = heading + '\n' + value;
            isFirstText = false;
          }
          return [{ ...d, value }];
        }
        return [d];
      }),
    };
  });

  // TODO - use XML? (multiline rrules, better model inference, etc)
  const userInstructions = chat.incognito ? [] : useSettings.getState().getInstructions();
  const instructions =
    `Formatting re-enabled.

## Instructions

Today's date is ${new Date().toLocaleDateString()}. For time-sensitive topics (news, software, etc.), search rather than relying on training data.
Always take conversation timing into account. Do not assume the chat is continuous. Consider whether the user's intent has changed between messages.

Render responses in Markdown — use headers, tables, lists, and code blocks where helpful. Use LaTeX for math. Keep paragraphs short.

If the user asks for a regular update, use the add_action tool. If the user seems interested in a topic with frequent updates, ask if they'd like an action added.

## Identity

This conversation may include responses from multiple AI models. Your model name is "${modelName}".
Only messages labeled [assistant:model=${modelName}] were written by you. Other assistant messages were written by different models and may have different knowledge and capabilities.
When referencing past assistant messages, always use the model name - do not say "I". Critique past assistant messages from your own perspective when appropriate.

Do not include the [assistant:model=...] label in your response.

## Context

The user's scheduled actions in this chat:

${actions.length ? actions.map((a) => `- [${a.id}] ${extractText(zData.parse(a.data))} (${a.schedule})`).join('\n') : '- (none)'}

Relevant memories of the user across all chats:

${memories.length ? memories.map((m) => `- ${m}`).join('\n') : '- (none)'}

When the user shares information that could improve future chats, store it as memory even if it was mentioned only once.
Store anything that could be relevant later. When unsure, prefer storing the memory with an appropriate confidence score rather than skipping it entirely.
Pay special attention to the user's technology stack, development environment, architectural decisions, and coding pain points.
SHORT_TERM and MEDIUM_TERM memories are encouraged for active conversations, experiments, or temporary workflows.
Use search_memory to find more when it could improve the response.` +
    (userInstructions.length
      ? `\n\n` +
        `Additionally, the user provided the following instructions:\n` +
        `${userInstructions.join('\n')}`
      : '');

  return { context, instructions };
}

async function runGeneration({
  reply,
  instructions,
  context,
  config,
}: {
  reply: MessageUnomitted;
  instructions: string;
  context: MessageUnomitted[];
  config: zConfig;
}) {
  const abortController = new AbortController();
  abortController.signal.addEventListener('abort', () => reply.data.push({ type: 'abort' }));
  useProviders.setState({ abortController });

  const stream = generate(
    {
      instruction: instructions,
      context: context.map((m) => ({ id: m.id, author: m.author, data: m.data })),
      config,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    abortController.signal,
  );

  let lastFlush = 0;
  const flush = async () => {
    useChats.setState({ messages: [...useChats.getState().messages] });
    reply = useChats.getState().messages.find((m) => m.id === reply.id) as MessageUnomitted;
    await new Promise<void>((r) => setTimeout(r, 0));
    lastFlush = performance.now();
  };

  let error: unknown = null;

  try {
    let hasText = false;
    for await (const event of stream) {
      console.log('Received event:', event);

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
          const file = reply.data.filter((p) => p.type === 'file').find((p) => p.name === fileName);
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
              reply.data.filter((p) => p.type === 'file').find((p) => p.name === fileName)?.url,
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
