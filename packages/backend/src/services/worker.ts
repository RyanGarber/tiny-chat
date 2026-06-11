import type { zContextItem } from '@tiny-chat/shared/src/types/chat.ts';
import {
  Author,
  zConfig,
  zData,
  type zGenerateInput,
  type zMetadata,
} from '@tiny-chat/shared/src/types/chat.ts';
import {
  checkAllToolRequirements,
  getNextRunAt,
  texts,
  wrapMessage,
  wrapSkill,
} from '@tiny-chat/shared/src/utils.ts';
import { createId } from '@paralleldrive/cuid2';
import {
  generate,
  type GenerationCallbacks,
} from '@tiny-chat/shared/src/services/chat/generate.ts';
import { searchFiles } from '../routes/input.ts';
import { reorder } from '../routes/message.ts';
import { zCache, zSettings, zUser } from '@tiny-chat/shared/src/types/user.ts';
import backend from '../tools/index.ts';
import type { ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { chatProviders } from '@tiny-chat/shared/src/providers/chat/index.ts';
import { embed } from '@tiny-chat/shared/src/services/chat/embed.ts';
import { searchChats } from '../routes/chat.ts';
import { getEmbedding, searchMemories } from '../routes/context.ts';

export const getGenerationCallbacksBackend = (user: zUser): GenerationCallbacks => ({
  embed: async (text) => {
    const embedConfig = zSettings.parse(user.settings).embeddingConfig;
    if (!embedConfig) return null;
    const provider = chatProviders.find((p) => p.name === embedConfig.provider);
    if (!provider) return null;
    return (await embed(zUser.parse(user), provider, [text], embedConfig, process.env))[0] ?? null;
  },
  getEmbedding: async (input) => getEmbedding(zUser.parse(user), input),
  getChat: async (id, messageId) => {
    if (id) {
      return globalThis.prisma.chat.findUnique({
        where: { id },
      });
    } else if (messageId) {
      return (
        (
          await globalThis.prisma.message.findUnique({
            where: { id: messageId },
            include: { chat: true },
          })
        )?.chat ?? null
      );
    }
    return null;
  },
  searchChats: async (text, embedding, limit) =>
    (await searchChats(zUser.parse(user), text, embedding, limit)).results,
  listActions: () => globalThis.prisma.action.findMany({ where: { userId: user.id } }),
  listUploadFiles: (uploadId) => globalThis.prisma.file.findMany({ where: { uploadId } }),
  searchFiles: (uploads, text, embedding, limit) =>
    searchFiles(zUser.parse(user), uploads, text, embedding, limit),
  searchMemories: (text, embedding, limit) => searchMemories(user, text, embedding, limit),
});

export default async function onTick() {
  const actions = await globalThis.prisma.action.findMany();
  const now = new Date();

  for (const action of actions) {
    try {
      const nextRunAt = getNextRunAt(action);
      if (!nextRunAt || nextRunAt > now) continue;
      console.log('Running action', action.id, 'scheduled for', nextRunAt);

      await globalThis.prisma.action.update({
        where: { id: action.id },
        data: { lastRanAt: now },
      });

      const user = await globalThis.prisma.user.findUniqueOrThrow({
        where: { id: action.userId },
      });

      const chat = await globalThis.prisma.chat.findUniqueOrThrow({
        where: { id: action.chatId },
        include: { messages: true },
      });
      const messages = reorder(chat.messages).map(wrapMessage);

      const userMessage = wrapMessage(
        await globalThis.prisma.message.create({
          data: {
            id: createId(),
            user: { connect: { id: action.userId } },
            folder: { connect: { id: action.folderId } },
            chat: { connect: { id: action.chatId } },
            config: zConfig.parse(action.config),
            author: Author.USER,
            data: zData.parse(action.data),
            metadata: [],
            previous: { connect: { id: messages[messages.length - 1]?.id } },
          },
        }),
      );

      const controller = new AbortController();

      const context: zContextItem[] = [...messages, userMessage].map(
        (m): zContextItem => ({
          id: m.id,
          author: m.author,
          data: m.data,
          config: m.config,
          createdAt: m.createdAt,
        }),
      );
      const generateInput: zGenerateInput = {
        timezone: action.timezone,
        config: zConfig.parse(action.config),
        incognito: chat.incognito,
        context,
        supportsUserInput: false,
      };

      const skills = await globalThis.prisma.skill.findMany({
        where: { userId: action.userId },
        include: { files: true },
      });

      const data: zData = [];
      const metadata: zMetadata = [];

      const generation = generate(
        user as zUser,
        chatProviders.find((p) => p.name === generateInput.config.provider)!,
        getGenerationCallbacksBackend(user as zUser),
        checkAllToolRequirements(
          backend,
          { user: user as zUser, chat, generation: generateInput, skills: [] }, // TODO - skills
          false,
          zCache.parse(user.cache).providers,
        ) as ToolGroup[],
        skills.flatMap((s) => wrapSkill(s.files, { id: s.id }) ?? []),
        generateInput,
        data,
        metadata,
        process.env,
        { abortSignal: controller.signal },
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of generation) {
        // nothing to do here
      }

      const replyId = createId();
      await globalThis.prisma.message.create({
        data: {
          id: replyId,
          user: { connect: { id: action.userId } },
          folder: { connect: { id: action.folderId } },
          chat: { connect: { id: action.chatId } },
          config: zConfig.parse(action.config),
          author: Author.MODEL,
          data: [],
          metadata: [],
          previous: { connect: { id: userMessage.id } },
        },
      });

      console.log('Generation complete for action', action.id, texts(action.data as zData));

      await globalThis.prisma.message.update({
        where: { id: replyId },
        data: {
          data,
          metadata,
        },
      });
    } catch (e) {
      console.error(`Error running action ${action.id}:`, e);
    }
  }
}
