import { createId } from '@paralleldrive/cuid2';
import { procedure, router } from '../index.ts';
import { type FolderGetPayload, type MessageCreateInput } from '../../generated/prisma/models.ts';

export default router({
  list: procedure.query(async ({ ctx }) => {
    // TODO move ordering to 'lastActivity' column?
    const folders = await ctx.prisma.folder.findMany({
      where: { userId: ctx.session.user.id, chats: { some: { temporary: false } } },
      include: {
        chats: {
          where: { temporary: false },
          include: { messages: { select: { createdAt: true } } },
        },
      },
    });

    folders
      .sort((a, b) => {
        const aLatest = Math.max(
          ...a.chats.map((item) =>
            Math.max(
              item.createdAt.getTime(),
              ...item.messages.map((item) => item.createdAt.getTime()),
            ),
          ),
        );
        const bLatest = Math.max(
          ...b.chats.map((item) =>
            Math.max(
              item.createdAt.getTime(),
              ...item.messages.map((item) => item.createdAt.getTime()),
            ),
          ),
        );
        return bLatest - aLatest;
      })
      .forEach((chat) => {
        chat.chats.sort((a, b) => {
          const aLatest = Math.max(
            a.createdAt.getTime(),
            ...a.messages.map((item) => item.createdAt.getTime()),
          );
          const bLatest = Math.max(
            b.createdAt.getTime(),
            ...b.messages.map((item) => item.createdAt.getTime()),
          );
          return bLatest - aLatest;
        });
      });

    // dirty dirty dirty (see above comment)
    for (const folder of folders) {
      for (const chat of folder.chats) {
        delete (chat as any).messages;
      }
    }
    return folders as FolderListData[];
  }),
});

export type FolderListData = FolderGetPayload<{ include: { chats: true } }>;

export async function createForChat(
  userId: string,
  temporary: boolean,
  incognito: boolean,
  message: MessageCreateInput,
) {
  const id = createId();
  return globalThis.prisma.folder.create({
    data: {
      id,
      user: { connect: { id: userId } },
      chats: {
        create: {
          id: createId(),
          user: { connect: { id: userId } },
          temporary,
          incognito,
          messages: {
            create: {
              ...message,
              folder: { connect: { id } },
            },
          },
        },
      },
    },
    include: { chats: { include: { messages: true } } },
  });
}
