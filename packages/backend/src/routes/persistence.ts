import { z } from 'zod';
import { zContextItem } from '@tiny-chat/shared/src/types/chat.ts';
import { zCache, type zUser } from '@tiny-chat/shared/src/types/user.ts';
import { snippetText } from '@tiny-chat/shared/src/utils.ts';
import { getMostRelevant } from '@tiny-chat/shared/src/services/chat/embed.ts';
import type { Action, File, Memory } from '../../generated/prisma/client.ts';
import { Prisma } from '../../generated/prisma/client.ts';
import { fetchProviders } from '@tiny-chat/shared/src/providers/index.ts';
import { procedure, router } from '../index.ts';

export default router({
  getCache: procedure.query(async ({ ctx }) => {
    if (!ctx.session.user.settings.useProviderCache) {
      return updateCache(ctx.session.user);
    }
    return zCache.parse(
      (
        await globalThis.prisma.user.findUniqueOrThrow({
          where: { id: ctx.session.user.id },
          select: { cache: true },
        })
      ).cache,
    );
  }),

  updateCache: procedure.mutation(async ({ ctx }) => {
    return updateCache(ctx.session.user);
  }),

  listMemories: procedure.query(async ({ ctx }): Promise<Memory[]> => {
    return globalThis.prisma.memory.findMany({
      where: { userId: ctx.session.user.id },
    });
  }),

  listActions: procedure.query(async ({ ctx }): Promise<Action[]> => {
    return globalThis.prisma.action.findMany({
      where: { userId: ctx.session.user.id },
    });
  }),

  listUploads: procedure
    .input(
      z.object({
        is: z.string().optional(),
        isNot: z.string().optional(),
        limit: z.number().optional(),
        cursor: z.cuid2().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let uploads = await globalThis.prisma.upload.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (input.is) {
        uploads = uploads.filter((u) =>
          u.name.toLowerCase().startsWith(`${input.is!.toLowerCase()}:`),
        );
      }

      if (input.isNot) {
        uploads = uploads.filter(
          (u) => !u.name.toLowerCase().startsWith(`${input.isNot!.toLowerCase()}:`),
        );
      }

      if (input.limit) {
        const index = Math.max(
          0,
          uploads.findIndex((u) => u.id === input.cursor),
        );
        const nextCursor =
          index + input.limit < uploads.length ? uploads[index + input.limit].id : null;
        uploads = uploads.slice(index, index + input.limit);
        return { uploads, nextCursor };
      }

      return { uploads, nextCursor: null };
    }),

  listUploadFiles: procedure
    .input(z.object({ id: z.cuid2() }))
    .query(async ({ ctx, input }): Promise<File[]> => {
      return (
        await globalThis.prisma.upload.findUniqueOrThrow({
          where: { userId: ctx.session.user.id, id: input.id },
          include: { files: true },
        })
      ).files;
    }),

  searchUploadFiles: procedure
    .input(
      z.object({
        context: z.array(zContextItem),
        query: z.string(),
        queryEmbedding: z.array(z.number()),
        maxCount: z.number().optional(),
      }),
    )
    .mutation(({ input: { context, query, queryEmbedding, maxCount } }) => {
      return searchFiles(context, query, queryEmbedding, maxCount);
    }),

  deleteFiles: procedure
    .input(z.object({ type: z.enum(['upload', 'skill']), id: z.cuid2() }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === 'upload') {
        await globalThis.prisma.upload.delete({
          where: { id: input.id, userId: ctx.session.user.id },
        });
      } else {
        await globalThis.prisma.skill.delete({
          where: { id: input.id, userId: ctx.session.user.id },
        });
      }
    }),
});

export const SNIPPET_WINDOW = 2500;

export async function searchFiles(
  context: zContextItem[],
  query: string,
  queryEmbedding: number[],
  maxCount?: number,
) {
  const files = await globalThis.prisma.$queryRaw<(File & { embedding: string })[]>`
        SELECT * FROM file
        WHERE "uploadId" IN (${Prisma.join(
          context.flatMap((m) =>
            m.data
              .flat()
              .filter((d) => d.type === 'upload')
              .map((u) => u.id),
          ),
        )})
          AND embedding IS NOT NULL`;

  const candidates = files.map((f) => ({
    value: f,
    embedding: JSON.parse(f.embedding) as number[],
  }));

  const mostRelevant = getMostRelevant(queryEmbedding, candidates, { maxCount });

  if (!mostRelevant.length) {
    return 'No relevant files found.';
  }

  return mostRelevant
    .map((res) => {
      const file = res.value as File;
      const text = Buffer.from(file.data).toString('utf-8');
      const snippet = snippetText(text, query, SNIPPET_WINDOW);
      return `File: ${file.path.join('/')}\nRelevance Score: ${res.score.toFixed(3)}\n\n${snippet}`;
    })
    .join('\n\n---\n\n');
}

async function updateCache(user: zUser) {
  const cache = zCache.parse(
    (
      await globalThis.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { cache: true },
      })
    ).cache,
  );
  cache.providers = await fetchProviders(user);
  await globalThis.prisma.user.update({
    where: { id: user.id },
    data: { cache: cache as any },
  });
  return cache;
}
