import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { reorder } from './messages.ts';
import { zConfig, zData, zMetadata } from '@tiny-chat/shared/src/types/chat.ts';
import { embed } from '@tiny-chat/shared/src/services/chat/embed.ts';
import { procedure, router } from '../index.ts';
import type { Chat } from '../../generated/prisma/client.ts';

interface Result {
  id: string;
  chatId: string;
  data: zData;
  chatTitle: string | null;
  folderTitle: string | null;
}

export default router({
  find: procedure
    .input(z.object({ id: z.cuid2().nullish(), messageId: z.cuid2().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.id) {
        return globalThis.prisma.chat.findUnique({
          where: { id: input.id, userId: ctx.session.user.id },
          include: { messages: { select: { createdAt: true } } },
        });
      } else if (input.messageId) {
        return (
          (
            await globalThis.prisma.message.findUnique({
              where: { id: input.messageId, userId: ctx.session.user.id },
              include: { chat: { include: { messages: { select: { createdAt: true } } } } },
            })
          )?.chat ?? null
        );
      }
      return null;
    }),

  edit: procedure
    .input(z.object({ id: z.cuid2(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const chat = await globalThis.prisma.chat.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.session.user.id },
        select: { title: true, folder: { select: { id: true, title: true } } },
      });
      await globalThis.prisma.chat.update({
        where: { id: input.id },
        data: {
          title: input.title,
          ...(chat.folder.title === chat.title
            ? { folder: { update: { title: input.title } } }
            : {}),
        },
      });
    }),

  clone: procedure
    .input(z.object({ id: z.cuid2(), untilMessageId: z.cuid2(), title: z.string() }))
    .mutation(async ({ ctx, input }): Promise<Chat> => {
      const chat = await globalThis.prisma.chat.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.session.user.id },
        include: { folder: { include: { chats: true } } },
      });
      let messages = reorder(
        await globalThis.prisma.message.findMany({
          where: { chatId: input.id },
        }),
      );

      let reachedMessage = false;
      messages = messages.filter((message) => {
        if (message.id === input.untilMessageId) {
          reachedMessage = true;
          return true;
        } else {
          return !reachedMessage;
        }
      });

      messages.forEach((message) => {
        const id = createId();
        const next = messages.find((m) => m.previousId === message.id);
        if (next) next.previousId = id;
        message.id = id;
        delete (message as any).chatId;
      });

      if (chat.folder.chats.length === 1) {
        await globalThis.prisma.folder.update({
          where: { id: chat.folderId },
          data: {
            title: chat.title,
          },
        });
      }

      return globalThis.prisma.chat.create({
        data: {
          id: createId(),
          user: { connect: { id: chat.userId } },
          folder: { connect: { id: chat.folderId } },
          title: input.title,
          temporary: chat.temporary,
          incognito: chat.incognito,
          messages: {
            createMany: {
              data: messages.map((message) => ({
                ...message,
                config: zConfig.parse(message.config),
                data: zData.parse(message.data),
                metadata: zMetadata.parse(message.metadata),
              })),
            },
          },
        },
      });
    }),

  delete: procedure.input(z.object({ id: z.cuid2() })).mutation(async ({ ctx, input }) => {
    const chat = await globalThis.prisma.chat.findUniqueOrThrow({
      where: { id: input.id, userId: ctx.session.user.id },
      include: { folder: { select: { chats: { select: { _count: true } } } } },
    });
    if (chat.folder.chats.length === 1)
      await globalThis.prisma.folder.delete({ where: { id: chat.folderId } });
    else await globalThis.prisma.chat.delete({ where: { id: input.id } });
  }),

  search: procedure
    .input(
      z.object({
        text: z.string().min(1),
        config: zConfig.optional(),
        limit: z.number().optional(),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }): Promise<{ results: Result[]; nextCursor: string | null }> => {
      console.log(`Searching for "${input.text}" in all chats`);

      const queryEmbeddings = ctx.session.user.settings.useEmbeddingSearch
        ? await embed(ctx.session.user, [input.text], process.env)
        : null;
      const useEmbedding = !!queryEmbeddings?.[0]?.length;
      console.log(`Using embedding: ${useEmbedding}`);

      const websearch = useEmbedding ? input.text : input.text.split(' ').join(' OR ');
      let results = await globalThis.prisma.$queryRaw<Result[]>`
        WITH search AS (
          SELECT websearch_to_tsquery('english', ${websearch}) AS query
        ),
        embedding_result AS (
          SELECT
            m.id,
            ROW_NUMBER() OVER (ORDER BY m.embedding <=> ${JSON.stringify(queryEmbeddings?.[0])}) AS score
          FROM message m
          JOIN chat c ON m."chatId" = c.id
          WHERE m."userId" = ${ctx.session.user.id}
            AND c.temporary = false
            AND m.embedding IS NOT NULL
            AND ${useEmbedding ? 1 : 0} = 1
          ORDER BY m.embedding <=> ${JSON.stringify(queryEmbeddings?.[0])}
          LIMIT 250
        ),
        lexicon_result AS (
          SELECT
            m.id,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(m.lexicon, search.query) DESC) AS score
          FROM message m
          JOIN chat c ON m."chatId" = c.id
          CROSS JOIN search
          WHERE m."userId" = ${ctx.session.user.id}
            AND c.temporary = false
            AND m.lexicon @@ search.query
          LIMIT 250
        ),
        combined_result AS (
          SELECT
            COALESCE(e.id, l.id) AS id,
            (COALESCE(1.0 / (60 + e.score), 0) + COALESCE(1.0 / (60 + l.score), 0)) AS score
          FROM embedding_result e
          FULL OUTER JOIN lexicon_result l ON e.id = l.id
        )
        SELECT
          m.id AS id,
          m."chatId" AS "chatId",
          m.data AS data,
          c.title AS "chatTitle",
          f.title AS "folderTitle"
        FROM combined_result
        JOIN message m ON m.id = combined_result.id
        CROSS JOIN LATERAL jsonb_array_elements(m.data) AS "dataPart"
        LEFT JOIN chat c ON m."chatId" = c.id
        LEFT JOIN "folder" f ON m."folderId" = f.id
        GROUP BY m.id, m."chatId", m.lexicon, c.title, f.title, combined_result.score
        ORDER BY combined_result.score DESC
        LIMIT 50
      `;

      console.log(`Found ${results.length} results`);

      if (input.limit) {
        const index = Math.max(
          0,
          results.findIndex((r) => r.id === input.cursor),
        );
        const nextCursor =
          index + input.limit < results.length ? results[index + input.limit].id : null;
        results = results.slice(index, index + input.limit);
        return { results, nextCursor };
      }

      return { results, nextCursor: null };
    }),
});
