import rrule from 'rrule';
import { generate } from './generate.ts';
import type { User } from './server.ts';
import type { ContextItem, zMetadata } from './types.ts';
import { wrapMessageUnomitted, zConfig, zData } from './types.ts';
import { embedMessage, reorder } from './routes/messages.ts';
import { Author } from '../generated/prisma/enums.ts';
import { createId } from '@paralleldrive/cuid2';
import logfile from './logfile.ts';

export default async function onTick() {
  const actions = await globalThis.prisma.action.findMany();
  const now = new Date();

  for (const action of actions) {
    try {
      const startAt =
        !action.lastRanAt || action.lastRanAt < action.createdAt
          ? action.createdAt
          : action.lastRanAt;

      const schedule = rrule.rrulestr(
        action.schedule,
        action.schedule.includes('DTSTART') ? {} : { dtstart: startAt },
      );

      // For the first run, use an inclusive boundary (startAt - 1ms) so that
      // a one-time action whose single occurrence sits exactly at createdAt
      // (the embedded DTSTART) is not missed by the exclusive after() search.
      // For subsequent runs keep it exclusive to prevent re-firing.
      const searchFrom = !action.lastRanAt
        ? new Date(startAt.getTime() - 1)
        : startAt;
      const nextRunAt = schedule.after(searchFrom, false);

      if (nextRunAt && nextRunAt <= now) {
        const user = (await globalThis.prisma.user.findUniqueOrThrow({
          where: { id: action.userId },
        })) as User;
        user.settings = JSON.parse(user.settings as unknown as string) as User['settings'];
        const messages = reorder(
          await globalThis.prisma.message.findMany({
            where: { chatId: action.chatId },
          }),
        ).map(wrapMessageUnomitted);

        const context: ContextItem[] = [...messages];
        context.push({
          id: null,
          author: Author.USER,
          data: zData.parse(action.data),
        });

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
            logfile('Got metadata for action', action.id);
          }
        }

        logfile('Generation complete for action', action.id, { data });

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

        await globalThis.prisma.action.update({
          where: { id: action.id },
          data: { lastRanAt: now },
        });

        await embedMessage(user, userMessage);
        await embedMessage(user, modelMessage);
      }
    } catch (e) {
      logfile(`Error running action ${action.id}:`, e);
      await globalThis.prisma.action.update({
        where: { id: action.id },
        data: { lastRanAt: now }, // TODO - better error handling
      });
    }
  }
}
