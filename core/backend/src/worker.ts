import { generate } from './endpoints/generate.ts';
import type { User } from './server.ts';
import { type ContextItem, getNextRunAt, texts, type zMetadata } from './types.ts';
import { wrapMessageUnomitted, zConfig, zData } from './types.ts';
import { embedMessage, reorder } from './routes/messages.ts';
import { Author } from '../generated/prisma/enums.ts';
import { createId } from '@paralleldrive/cuid2';

export default async function onTick() {
  const actions = await globalThis.prisma.action.findMany();
  const now = new Date();

  for (const action of actions) {
    try {
      const nextRunAt = await getNextRunAt(action);
      if (!nextRunAt || nextRunAt > now) continue;

      await globalThis.prisma.action.update({
        where: { id: action.id },
        data: { lastRanAt: now },
      });

      const user = (await globalThis.prisma.user.findUniqueOrThrow({
        where: { id: action.userId },
      })) as User;
      user.settings = JSON.parse(user.settings as unknown as string) as User['settings'];

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
          createdAt: new Date(0),
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

      const data: zData = [];
      const metadata: zMetadata = [];
      for await (const event of generation) {
        if (event.type === 'data') {
          if (event.value.type === 'text') {
            const last = data[data.length - 1];
            if (last?.type === 'text') last.value += event.value.value;
            else data.push(event.value);
          } else {
            data.push(event.value);
          }
        }
        if (event.type === 'special' && event.value.type === 'metadata') {
          metadata.push(event.value.value);
          console.log('Got metadata for action', action.id);
        }
      }

      console.log('Generation complete for action', action.id, texts(action.data as zData));

      const modelMessage = await globalThis.prisma.message.create({
        data: {
          id: createId(),
          user: { connect: { id: action.userId } },
          folder: { connect: { id: action.folderId } },
          chat: { connect: { id: action.chatId } },
          config: zConfig.parse(action.config),
          author: Author.MODEL,
          data,
          metadata,
          previous: { connect: { id: userMessage.id } },
        },
      });

      await globalThis.prisma.message.update({
        where: { id: userMessage.id },
        data: { createdAt: new Date() },
      });

      await embedMessage(user, userMessage);
      await embedMessage(user, modelMessage);
    } catch (e) {
      console.error(`Error running action ${action.id}:`, e);
    }
  }
}
