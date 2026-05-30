import {
  Author,
  type zConfig,
  type zContextItem,
  type zData,
  type zDataPart,
  type zGenerateInput,
  type MessageState,
  type zMetadata,
} from '@tiny-chat/shared/src/types/chat.ts';
import type { ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import type { zSkill } from '@tiny-chat/shared/src/types/skill.ts';
import {
  alignToolResults,
  generate,
  type GenerationCallbacks,
} from '@tiny-chat/shared/src/services/chat/generate.ts';
import type { Chat } from '@tiny-chat/backend/generated/prisma/client.ts';
import { type Stream, StreamService } from '@/features/message/services/StreamService';
import { auth, backendUrl, isTauriDesktop, trpc } from '@/utils/api.ts';
import { checkAllToolRequirements } from '@tiny-chat/shared/src/utils.ts';
import { smoothStream } from 'ai';
import { refetchMessages } from '@/features/message/hooks/useMessages.ts';
import { refetchChatList } from '@/features/chat/hooks/useChatList';
import { refetchMemories } from '@/features/chat/hooks/useMemories.ts';
import { refetchActions } from '@/features/chat/hooks/useActions.ts';
import { isMissingToolResult } from '@/utils/ui';
import type { zCache } from '@tiny-chat/shared/src/types/user';

/* ───────────────────────────── Controller ────────────────────────────── */

export interface BaseGenerateProps {
  tools: ToolGroup[];
  skills: zSkill[];
  providers: zCache['providers'];
  activeChat: Chat | null;
}

interface OnModelMessageProps extends BaseGenerateProps {
  message: MessageState;
  append?: zDataPart[];
  activeChat: Chat;
}

interface GenerateProps extends BaseGenerateProps {
  stream: Stream;
  context: zContextItem[];
  config: zConfig;
  tools: ToolGroup[];
  activeChat: Chat;
}

export const GenerateService = {
  /**
   * Trigger model generation for an existing user message. If `message` is a
   * model reply, the seed user message is resolved automatically. When
   * `append` is provided (e.g. a user-supplied tool result), it is appended
   * to the last data slot of the reply before generation continues.
   */
  handle: async ({
    message,
    activeChat,
    append,
    tools,
    providers,
    skills,
  }: OnModelMessageProps): Promise<void> => {
    console.log('[Generation] handling model message', message, activeChat, append);
    let seed: MessageState | undefined = message;
    if (message.author === Author.MODEL) {
      const messages = await trpc.messages.list.query({ chatId: activeChat.id });
      seed = messages.find((m) => m.id === message.previousId);
    }
    if (!seed) throw new Error(`Could not find seed (user) message for ${message.id}`);

    const { reply, context } = await GenerateService._prepare(seed, activeChat, append);

    if (isMissingToolResult(reply.message)) {
      // Awaiting more user tool inputs — do not start generation yet.
      return;
    }

    void GenerateService._generate({
      stream: reply,
      context,
      config: seed.config,
      tools,
      activeChat,
      providers,
      skills,
    });
  },

  /** Find or create the model reply and start a stream for it. */
  _prepare: async (
    seed: MessageState,
    activeChat: Chat,
    append?: zDataPart[],
  ): Promise<{ reply: Stream; context: zContextItem[] }> => {
    console.log('[Generation] preparing reply', seed, activeChat, append);
    // Fetch full message list once so we can both locate the existing reply
    // and build the generation context from a single source of truth.
    const messages = await trpc.messages.list.query({ chatId: seed.chatId });
    const existing = messages.find((m) => m.previousId === seed.id);

    let reply: MessageState;
    if (existing) {
      let data: zData = [];
      let metadata: zMetadata = [];
      if (append) {
        data = existing.data.map((d, i) =>
          i === existing.data.length - 1 ? alignToolResults([...d, ...append]) : d,
        );
        metadata = [...existing.metadata];
      }
      const edited = await trpc.messages.edit.mutate({
        id: existing.id,
        config: seed.config,
        author: existing.author,
        data,
        metadata,
        truncate: false,
      });
      reply = { ...edited };
    } else {
      const created = await trpc.messages.create.mutate({
        author: Author.MODEL,
        chatId: seed.chatId,
        previousId: seed.id,
        temporary: activeChat.temporary,
        metadata: [],
        data: [],
        config: seed.config,
      });
      reply = { ...created };
    }

    await refetchMessages(seed.chatId);

    // Re-fetch to ensure the context reflects the inserted/edited reply.
    const refreshed = await trpc.messages.list.query({ chatId: seed.chatId });
    const replyIndex = refreshed.findIndex((m) => m.id === reply.id);
    const replyRef = replyIndex >= 0 ? refreshed[replyIndex] : reply;

    // Mirror metadata onto the streaming snapshot so the controller can commit
    // it back at the end of the run.
    const stream = StreamService.start(replyRef);
    stream.apply((m) => {
      m.state.any = true;
    });

    const context: zContextItem[] = refreshed
      .slice(0, (replyIndex >= 0 ? replyIndex : refreshed.length) + 1)
      .map(
        (m): zContextItem => ({
          id: m.id,
          author: m.author,
          data: m.data,
          config: m.config,
          createdAt: m.createdAt,
        }),
      );

    return { reply: stream, context };
  },

  /** Run the generation loop, pumping deltas into the stream registry. */
  _generate: async ({
    stream,
    context,
    config,
    tools,
    skills,
    activeChat,
    providers,
  }: GenerateProps): Promise<void> => {
    console.log('[Generation] generating', stream, context, config, tools, activeChat);
    const user = (await auth.getSession()).data!.user;
    const input: zGenerateInput = {
      context,
      config,
      incognito: activeChat.incognito,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      supportsUserInput: true,
    };

    const enabledTools = checkAllToolRequirements(
      tools,
      { user, chat: activeChat, generation: input, skills },
      await isTauriDesktop(),
      providers,
    ).filter((g): g is ToolGroup => config.toolGroups.includes(g.name));

    const enabledSkills = skills.filter((s) => config.skills?.includes(s.name));

    console.log('enabledTools:', enabledTools);
    console.log('enabledSkills:', enabledSkills);

    const generator = generate(
      user,
      callbacks,
      enabledTools,
      enabledSkills,
      input,
      stream.message.data,
      stream.message.metadata,
      { ...import.meta.env, VITE_BACKEND_URL: backendUrl },
      {
        abortSignal: stream.abort.signal,
        experimental_transform: [smoothStream({ delayInMs: 20 })],
      },
    );

    let rafId: number | null = null;
    const scheduleApply = (apply?: (m: MessageState) => void) => {
      if (rafId) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        stream.apply(apply);
        rafId = null;
      });
    };

    for await (const event of generator) {
      scheduleApply((m) => {
        if (event.type === 'data') {
          if (event.value.type === 'text') {
            m.state.thinking = false;
            m.state.generating = true;
          } else if (event.value.type === 'thought') {
            m.state.thinking = true;
          }
        }
      });
    }

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    stream.apply((m) => {
      m.state.any = false;
      m.state.thinking = false;
      m.state.generating = false;
    });

    await GenerateService._finalize(stream);
    StreamService.stop(stream.id);
  },

  /** Persist the final reply state to the server. */
  _finalize: async (stream: Stream): Promise<void> => {
    console.log('[Generation] finalizing', stream);
    const { message } = stream;
    await trpc.messages.edit.mutate({
      id: message.id,
      author: message.author,
      config: message.config,
      data: message.data,
      metadata: message.metadata,
      truncate: false,
    });
    console.log('refetching');
    await refetchChatList();
    await refetchMessages(message.chatId);
    void refetchActions();
    void refetchMemories();
  },

  /** Abort a single in-flight stream. */
  abort: (streamId: string): void => {
    console.log('[Generation] aborting stream', streamId);
    StreamService.get(streamId)?.abort.abort();
    StreamService.stop(streamId);
  },
} as const;

export const callbacks: GenerationCallbacks = {
  fetchChat: (id, messageId) => trpc.chats.find.query({ id, messageId }),
  fetchActions: () => trpc.persistence.listActions.query(),
  fetchUploadFiles: (id) => trpc.persistence.listUploadFiles.query({ id }),
  searchFiles: (context, query, queryEmbedding, maxCount) =>
    trpc.persistence.searchUploadFiles.mutate({
      context,
      query,
      queryEmbedding,
      maxCount,
    }),
  getMemoryContext: (user, context) => trpc.embeddings.getMemoryContext.mutate({ user, context }),
  getContextEmbedding: (user, context) =>
    trpc.embeddings.getContextEmbedding.mutate({ user, context }),
} as const;
