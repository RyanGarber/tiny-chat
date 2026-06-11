import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { Author, type Message as PrismaMessage } from '../../generated/prisma/client.ts';
import { type MessageCreateInput } from '../../generated/prisma/models.ts';
import { zConfig, zData, zMetadata } from '@tiny-chat/shared/src/types/chat.ts';
import { wrapMessage } from '@tiny-chat/shared/src/utils.ts';
import { procedure, router } from '../index.ts';
import { createFolder } from './chat.ts';

export default router({
  create: procedure
    .input(
      z.object({
        chatId: z.cuid2().optional(),
        author: z.enum(Author),
        config: zConfig,
        data: zData,
        metadata: zMetadata,
        previousId: z.cuid2().optional(),
        temporary: z.boolean().optional(),
        incognito: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const self: Partial<MessageCreateInput> = {
        id: createId(),
        user: { connect: { id: ctx.session.user.id } },
        author: input.author,
        config: input.config,
        data: input.data,
        metadata: input.metadata,
        previous: input.previousId ? { connect: { id: input.previousId } } : undefined,
      };

      let message;

      if (input.chatId) {
        const chat = await globalThis.prisma.chat.findUniqueOrThrow({
          where: { id: input.chatId, userId: ctx.session.user.id },
        });

        if (input.temporary && !chat.temporary) throw new Error('Chat cannot be made temporary');
        if (input.incognito && !chat.incognito) throw new Error('Chat cannot be made incognito');

        message = await globalThis.prisma.$transaction(async (tx) => {
          if (input.previousId) {
            await globalThis.prisma.message.updateMany({
              where: { previousId: input.previousId },
              data: { previousId: null },
            });
          } else {
            const messages = reorder(await tx.message.findMany({ where: { chatId: chat.id } }));
            (self as any).previous = { connect: { id: messages[messages.length - 1].id } };
          }

          (self as any).folder = { connect: { id: chat.folderId } };
          (self as any).chat = { connect: { id: chat.id } };
          const message = await tx.message.create({ data: self as MessageCreateInput });

          if (input.previousId) {
            await tx.message.updateMany({
              where: {
                AND: [{ previousId: input.previousId }, { NOT: { id: self.id } }],
              },
              data: { previousId: message.id },
            });
          }

          return message;
        });
      } else {
        message = (
          await createFolder(
            ctx.session.user.id,
            input.temporary ?? false,
            input.incognito ?? false,
            self as MessageCreateInput,
          )
        ).chats[0].messages[0];
      }

      return wrapMessage(message);
    }),

  edit: procedure
    .input(
      z.object({
        id: z.cuid2(),
        author: z.enum(Author),
        config: zConfig,
        data: zData,
        metadata: zMetadata,
        truncate: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log(`Editing message ${input.id} (truncate: ${input.truncate})`);

      if (input.truncate) {
        console.log(`Truncating messages after ${input.id}`);
        let message = await globalThis.prisma.message.findUniqueOrThrow({
          where: { id: input.id, userId: ctx.session.user.id },
          include: { next: true },
        });
        const toDelete: string[] = [];
        while (message.next) {
          const nextMessage = await globalThis.prisma.message.findUniqueOrThrow({
            where: { id: message.next.id, userId: ctx.session.user.id },
            include: { next: true },
          });
          toDelete.push(nextMessage.id);
          message = nextMessage;
        }
        await globalThis.prisma.message.deleteMany({ where: { id: { in: toDelete } } });
      }

      const message = await globalThis.prisma.message.update({
        where: { id: input.id, userId: ctx.session.user.id },
        data: {
          author: input.author,
          config: input.config,
          data: input.data,
          metadata: input.metadata,
          createdAt: new Date(),
        },
      });

      return wrapMessage(message);
    }),

  delete: procedure.input(z.object({ id: z.cuid2() })).mutation(async ({ ctx, input }) => {
    const message = await globalThis.prisma.message.findUniqueOrThrow({
      where: { id: input.id, userId: ctx.session.user.id },
      include: {
        previous: { include: { previous: true } },
        next: { include: { next: true } },
        folder: { include: { chats: true, messages: true } },
        chat: { include: { messages: true } },
      },
    });

    const where = { OR: [{ id: message.id }] };

    let linkPrevious = message.previous?.id;
    let linkNext = message.next?.id;

    if (message.previous && message.author === Author.MODEL) {
      where.OR.push({ id: message.previous.id });
      linkPrevious = message.previous.previous?.id;
    }
    if (message.next && message.author === Author.USER) {
      where.OR.push({ id: message.next.id });
      linkNext = message.next.next?.id;
    }

    if (linkPrevious && linkNext) {
      await globalThis.prisma.message.update({
        where: { id: linkPrevious },
        data: { next: { connect: { id: linkNext } } },
      });
      await globalThis.prisma.message.update({
        where: { id: linkNext },
        data: { previous: { connect: { id: linkPrevious } } },
      });
    }

    if (message.author === Author.USER && message.next) where.OR.push({ id: message.next.id });
    else if (message.author === Author.MODEL && message.previous)
      where.OR.push({ id: message.previous.id });

    if (message.folder.messages.length <= 2) {
      await globalThis.prisma.folder.delete({ where: { id: message.folderId } });
      return true;
    } else if (message.chat.messages.length <= 2) {
      await globalThis.prisma.chat.delete({ where: { id: message.chatId } });
      return true;
    }
    await globalThis.prisma.message.deleteMany({ where });
    return false;
  }),

  list: procedure
    .input(
      z.object({
        chatId: z.cuid2().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.chatId) return [];
      return reorder(
        await globalThis.prisma.message.findMany({
          where: { chatId: input.chatId, userId: ctx.session.user.id },
        }),
      ).map(wrapMessage);
    }),

  listInfinite: procedure
    .input(
      z.object({
        chatId: z.cuid2().nullish(),
        limit: z.number().optional(),
        cursor: z.cuid2().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.chatId) return { messages: [], nextCursor: null };

      const messages = reorder(
        (
          await globalThis.prisma.message.findMany({
            where: { chatId: input.chatId, userId: ctx.session.user.id },
            omit: { metadata: true },
          })
        ).map((m) => ({ ...m, metadata: ['_omit'] })),
      ).map(wrapMessage);

      if (input.limit) {
        const index = input.cursor
          ? messages.findIndex((m) => m.id === input.cursor)
          : messages.length;

        const start = Math.max(0, index - input.limit);
        const slice = messages.slice(start, index);

        const nextCursor = start > 0 ? messages[start].id : null;
        return { messages: slice, nextCursor };
      }

      return { messages, nextCursor: null };
    }),
});

export function reorder(messages: PrismaMessage[]) {
  if (messages.length <= 1) return messages;

  const firstMessage = messages.find((m) => m.previousId === null);
  if (!firstMessage) return messages;

  const sorted = [firstMessage];

  let currentId = firstMessage.id;
  while (sorted.length < messages.length) {
    const nextMessage = messages.find((m) => m.previousId === currentId);
    if (!nextMessage) break;
    sorted.push(nextMessage);
    currentId = nextMessage.id;
  }

  return sorted;
}
