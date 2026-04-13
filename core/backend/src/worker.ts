import { generate, generateStream, persistReply } from './services/generate.ts';
import type { User } from './server.ts';
import { type ContextItem, getNextRunAt, texts, type zMetadata } from './types.ts';
import { wrapMessageUnomitted, zConfig, zData } from './types.ts';
import { reorder } from './routes/messages.ts';
import { Author } from '../generated/prisma/enums.ts';
import { createId } from '@paralleldrive/cuid2';

export default async function onTick() {
  const actions = await globalThis.prisma.action.findMany();
  const now = new Date();

  for (const action of actions) {
    try {
      const nextRunAt = await getNextRunAt(action);
      if (!nextRunAt || nextRunAt > now) continue;
      console.log('Running action', action.id, 'scheduled for', nextRunAt);

      await globalThis.prisma.action.update({
        where: { id: action.id },
        data: { lastRanAt: now },
      });

      const user = (await globalThis.prisma.user.findUniqueOrThrow({
        where: { id: action.userId },
      })) as User;

      const messages = reorder(
        await globalThis.prisma.message.findMany({
          where: { chatId: action.chatId },
        }),
      ).map(wrapMessageUnomitted);

      const userMessage = await globalThis.prisma.message.create({
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
      });

      const context: ContextItem[] = [...messages, wrapMessageUnomitted(userMessage)];
      const controller = new AbortController();
      const generation = generate(
        user,
        {
          timezone: action.timezone,
          config: zConfig.parse(action.config),
          context: context,
          userInput: false,
        },
        controller,
      );

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

      const data: zData = [];
      const metadata: zMetadata = [];

      // Consume the generation stream using shared accumulation (discard events since no SSE client)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of generateStream(generation, data, metadata)) {
        // Worker has no SSE client; we just accumulate
      }

      console.log('Generation complete for action', action.id, texts(action.data as zData));

      await globalThis.prisma.message.update({
        where: { id: userMessage.id },
        data: { createdAt: new Date() },
      });

      await persistReply(user, replyId, data, metadata, userMessage.id);
    } catch (e) {
      console.error(`Error running action ${action.id}:`, e);
    }
  }
}
