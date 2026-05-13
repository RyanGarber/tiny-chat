import { Author, MemoryCategory, MemoryStability } from '../../generated/prisma/enums.ts';
import { type Memory, Prisma } from '../../generated/prisma/client.ts';
import { zContextItem, zData } from '@tiny-chat/shared/src/types/chat.ts';
import { zUser } from '@tiny-chat/shared/src/types/user.ts';
import { texts } from '@tiny-chat/shared/src/utils.ts';
import { embedMessage } from './messages.ts';
import { shouldEmbedFile } from '../utils.ts';
import {
  combineVectorsWeighted,
  embed,
  getMostRelevant,
} from '@tiny-chat/shared/src/services/chat/embed.ts';
import { z } from 'zod';
import { procedure, router } from '../index.ts';

export default router({
  fixMissing: procedure.mutation(async ({ ctx }) => {
    const messages = (
      await globalThis.prisma.$queryRaw<{ id: string; data: any }[]>`SELECT id, data
        FROM message
        WHERE "userId" = ${ctx.session.user.id}
          AND embedding IS NULL`
    ).filter((m) => texts(zData.parse(m.data)).trim().length);

    let messagesDone = 0;
    for (let i = 0; i < messages.length; i += 100) {
      console.log(
        `Processing messages ${i + 1}-${Math.min(i + 100, messages.length)} of ${messages.length}`,
      );
      const batch = messages.slice(i, i + 100);
      const embeddings = await embed(
        ctx.session.user,
        batch.map((m) => texts(zData.parse(m.data))),
        process.env,
      );
      if (!embeddings) {
        console.warn('Failed to generate embeddings for batch starting with message:', batch[0].id);
        continue;
      }
      console.log(
        `Generated embeddings for ${embeddings.length} messages:`,
        messages.map((m) => m.id),
      );
      await globalThis.prisma.$transaction(async (tx) => {
        for (let j = 0; j < batch.length; j++) {
          const embedding = embeddings?.[j];
          if (embedding) {
            await tx.$executeRaw`UPDATE message
                                 SET embedding = ${JSON.stringify(embedding)}::vector
                                 WHERE id = ${batch[j].id}`;
            messagesDone++;
          }
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    let memoriesDone = 0;
    const memories = await globalThis.prisma.$queryRaw<Memory[]>`SELECT *
      FROM memory
      WHERE "userId" = ${ctx.session.user.id}
        AND embedding IS NULL`;

    for (let i = 0; i < memories.length; i += 100) {
      const batch = memories.slice(i, i + 100);
      const embeddings = await embed(
        ctx.session.user,
        batch.map((m) => m.fact),
        process.env,
      );
      if (!embeddings) {
        console.warn('Failed to generate embeddings for batch starting with memory:', batch[0].id);
        continue;
      }
      await globalThis.prisma.$transaction(async (tx) => {
        for (let j = 0; j < batch.length; j++) {
          const embedding = embeddings?.[j];
          if (embedding) {
            await tx.$executeRaw`UPDATE memory
                                 SET embedding = ${JSON.stringify(embedding)}::vector
                                 WHERE id = ${batch[j].id}`;
            memoriesDone++;
          }
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    let filesDone = 0;
    const files = (
      await globalThis.prisma.$queryRaw<
        { id: string; data: Uint8Array; mime: string; path: string[] }[]
      >`SELECT id, data, mime, path
      FROM file
      WHERE "userId" = ${ctx.session.user.id}
        AND embedding IS NULL`
    ).filter((f) => shouldEmbedFile(f.path.join('/'), f.data));

    for (let i = 0; i < files.length; i += 100) {
      console.log('Trying to embed:', files[i]);
      const batch = files.slice(i, i + 100);
      const embeddings = await embed(
        ctx.session.user,
        batch.map((f) => new TextDecoder().decode(f.data)),
        process.env,
      );
      if (!embeddings) {
        console.warn('Failed to generate embeddings for batch starting with file:', batch[0].id);
        continue;
      }
      for (let j = 0; j < batch.length; j++) {
        const embedding = embeddings?.[j];
        if (embedding) {
          await globalThis.prisma.$executeRaw`UPDATE file
                               SET embedding = ${JSON.stringify(embedding)}::vector
                               WHERE id = ${batch[j].id}`;
          filesDone++;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return {
      messages: { total: messages.length, fixed: messagesDone },
      memories: { total: memories.length, fixed: memoriesDone },
      files: { total: files.length, fixed: filesDone },
    };
  }),

  reset: procedure.mutation(async ({ ctx }) => {
    await globalThis.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE message
                           SET embedding = NULL
                           WHERE "userId" = ${ctx.session.user.id}`;
      await tx.$executeRaw`UPDATE memory
                           SET embedding = NULL
                           WHERE "userId" = ${ctx.session.user.id}`;
    });
  }),

  getMemoryContext: procedure
    .input(z.object({ user: zUser, context: z.array(zContextItem) }))
    .mutation(({ input: { user, context } }) => {
      return getMemoryContext(user, context);
    }),

  getContextEmbedding: procedure
    .input(z.object({ user: zUser, context: z.array(zContextItem) }))
    .mutation(({ input: { user, context } }) => {
      return getContextEmbedding(user, context);
    }),
});

export async function getMemoryContext(user: zUser, context: zContextItem[]): Promise<string[]> {
  if (!user.settings?.embeddingConfig) return [];

  const embeddings: number[][] = [];
  for (const item of context.filter((m) => m.author === Author.USER).slice(-4)) {
    if (item.id) {
      const message = (
        await globalThis.prisma.$queryRaw<
          { id: string; data: any; embedding?: string }[]
        >`SELECT id, data, embedding
          FROM message
          WHERE id = ${item.id}`
      )[0];
      if (message.embedding) {
        embeddings.push(JSON.parse(message.embedding) as number[]);
      } else {
        console.warn(`No embedding for message, generating:`, message.data);
        const text = texts(zData.parse(message.data));
        if (text.trim().length) {
          const embedding = await embedMessage(user, message);
          if (embedding) embeddings.push(embedding);
        }
      }
    }
  }

  const memories = await globalThis.prisma.$queryRaw<(Memory & { embedding: string })[]>`SELECT *
        FROM memory
        WHERE "userId" = ${user.id}
          AND embedding IS NOT NULL`;

  if (embeddings.length) {
    const query = (await getContextEmbedding(user, context))?.queryEmbedding;
    if (query) {
      return prepareMemories([
        ...getMostRelevant(
          query,
          memories
            .filter((m) => m.stability === MemoryStability.LONG_TERM)
            .map((m) => ({ value: m, embedding: JSON.parse(m.embedding) as number[] })),
          { maxCount: 10 },
        ).map((r) => r.value as Memory & { embedding: string }),
        ...getMostRelevant(
          query,
          memories
            .filter((m) => m.stability === MemoryStability.MEDIUM_TERM)
            .map((m) => ({ value: m, embedding: JSON.parse(m.embedding) as number[] })),
          { maxCount: 5 },
        ).map((r) => r.value as Memory & { embedding: string }),
        ...getMostRelevant(
          query,
          memories
            .filter((m) => m.stability === MemoryStability.SHORT_TERM)
            .map((m) => ({ value: m, embedding: JSON.parse(m.embedding) as number[] })),
          { maxCount: 3 },
        ).map((r) => r.value as Memory & { embedding: string }),
      ]);
    }
  }

  return [];
}

export async function getContextEmbedding(user: zUser, context: zContextItem[]) {
  const embeddings: number[][] = [];

  const includedTexts: string[] = [];
  for (const item of context.filter((m) => m.author === Author.USER).slice(-4)) {
    if (item.id) {
      const message = (
        await globalThis.prisma.$queryRaw<
          { id: string; data: any; embedding?: string }[]
        >`SELECT id, data, embedding FROM message WHERE id = ${item.id}`
      )[0];

      const text = texts(zData.parse(message.data));
      includedTexts.push(text);

      if (message.embedding) {
        embeddings.push(JSON.parse(message.embedding) as number[]);
      } else if (text.trim().length) {
        const embedding = await embedMessage(user, message);
        if (embedding) embeddings.push(embedding);
      }
    }
  }

  if (!embeddings.length) return null;

  return {
    query: includedTexts.join(),
    queryEmbedding: combineVectorsWeighted(
      embeddings,
      { 1: [1.0], 2: [0.35, 0.65], 3: [0.2, 0.35, 0.45], 4: [0.15, 0.2, 0.3, 0.35] }[
        embeddings.length
      ]!,
    ),
  };
}

export async function getMemorySearch(
  user: zUser,
  embedding: number[],
  category?: MemoryCategory[],
): Promise<string[]> {
  return prepareMemories(
    getMostRelevant(
      embedding,
      (
        await globalThis.prisma.$queryRaw<
          (Memory & {
            embedding: string;
          })[]
        >`SELECT *
          FROM memory
          WHERE "userId" = ${user.id}
            AND embedding IS NOT NULL
            AND category IN (${Prisma.join(category ?? Object.values(MemoryCategory))})`
      ).map((m) => ({
        value: m,
        embedding: JSON.parse(m.embedding) as number[],
      })),
      { maxCount: 5 },
    ).map((m) => m.value as Memory),
  );
}

export function prepareMemories(memories: Memory[]) {
  const prepared: string[] = [];
  for (const memory of memories) {
    prepared.push(`[^${memory.id}] ${memory.category}: ${memory.fact}`);
  }
  return prepared;
}
