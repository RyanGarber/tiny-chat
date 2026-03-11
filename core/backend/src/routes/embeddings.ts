import { procedure, router } from '../index.ts';
import { MemoryCategory, MemoryStability } from '../../generated/prisma/enums.ts';
import { combineVectorsWeighted, embed, getMostRelevant } from '../embed.ts';
import { type Memory, type Message, Prisma } from '../../generated/prisma/client.ts';
import { type Session } from '../server.ts';
import { z } from 'zod';
import { texts, zData } from '../types.ts';

export default router({
  getMemoryContext: procedure
    .input(
      z.object({
        context: z.array(z.cuid2()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user.settings?.embeddingConfig) return [];

      return await globalThis.prisma.$transaction(async (tx) => {
        const messages = await tx.$queryRaw<(Message & { embedding: number[] })[]>`SELECT *
        FROM message
        WHERE "userId" = ${ctx.session.user.id}
          AND embedding IS NOT NULL
          AND id IN (${Prisma.join(input.context)})`;
        let context = input.context.map((id) => messages.find((c) => c.id === id)!.embedding);
        context = context.filter((c): c is number[] => !!c);

        const memories = await tx.$queryRaw<(Memory & { embedding: string })[]>`SELECT *
        FROM memory
        WHERE "userId" = ${ctx.session.user.id}
          AND embedding IS NOT NULL
          AND active`;

        const query = combineVectorsWeighted(
          context,
          { 1: [1.0], 2: [0.35, 0.65], 3: [0.2, 0.35, 0.45], 4: [0.15, 0.2, 0.3, 0.35] }[
            context.length
          ]!,
        );

        return prepareMemories([
          ...memories.filter((m) => m.stability === MemoryStability.LONG_TERM),
          ...getMostRelevant(
            query,
            memories
              .filter((m) => m.stability === MemoryStability.MEDIUM_TERM)
              .map((m) => ({ value: m as Memory, embedding: JSON.parse(m.embedding) as number[] })),
            { maxCount: 10 },
          ).map((m) => m.value as Memory),
          ...getMostRelevant(
            query,
            memories
              .filter((m) => m.stability === MemoryStability.SHORT_TERM)
              .map((m) => ({ value: m as Memory, embedding: JSON.parse(m.embedding) as number[] })),
            { maxCount: 5 },
          ).map((m) => m.value as Memory),
        ]);
      });
    }),

  fixMissing: procedure.mutation(async ({ ctx }) => {
    const messages = await globalThis.prisma.$queryRaw<
      Message[]
    >`SELECT * FROM message WHERE "userId" = ${ctx.session.user.id} AND embedding IS NULL`;

    let messagesDone = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const embeddings = await embed(
        ctx.session,
        batch.map((m) => texts(zData.parse(m.data))),
      );
      if (!embeddings) {
        console.warn('Failed to generate embeddings for batch starting with message:', batch[0].id);
        continue;
      }
      await globalThis.prisma.$transaction(async (tx) => {
        for (let j = 0; j < batch.length; j++) {
          const embedding = embeddings?.[j];
          if (embedding) {
            await tx.$executeRaw`UPDATE message SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${batch[j].id}`;
            messagesDone++;
          }
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    let memoriesDone = 0;
    const memories = await globalThis.prisma.$queryRaw<
      Memory[]
    >`SELECT * FROM memory WHERE "userId" = ${ctx.session.user.id} AND embedding IS NULL`;

    for (let i = 0; i < memories.length; i += 100) {
      const batch = memories.slice(i, i + 100);
      const embeddings = await embed(
        ctx.session,
        batch.map((m) => m.fact),
      );
      if (!embeddings) {
        console.warn('Failed to generate embeddings for batch starting with memory:', batch[0].id);
        continue;
      }
      await globalThis.prisma.$transaction(async (tx) => {
        for (let j = 0; j < batch.length; j++) {
          const embedding = embeddings?.[j];
          if (embedding) {
            await tx.$executeRaw`UPDATE memory SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${batch[j].id}`;
            memoriesDone++;
          }
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return {
      messages: { total: messages.length, fixed: messagesDone },
      memories: { total: memories.length, fixed: memoriesDone },
    };
  }),

  reset: procedure.mutation(async ({ ctx }) => {
    await globalThis.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE message SET embedding = NULL WHERE "userId" = ${ctx.session.user.id}`;
      await tx.$executeRaw`UPDATE memory SET embedding = NULL WHERE "userId" = ${ctx.session.user.id}`;
    });
  }),
});

export async function getMemorySearch(
  session: Session,
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
          WHERE "userId" = ${session.user.id}
            AND embedding IS NOT NULL
            AND category IN (${Prisma.join(category ?? Object.values(MemoryCategory))})
            AND active`
      ).map((m) => ({
        value: m as Memory,
        embedding: JSON.parse(m.embedding) as number[],
      })),
      { maxCount: 5 },
    ).map((m) => m.value as Memory),
  );
}

function prepareMemories(memories: Memory[]) {
  const prepared: string[] = [];
  for (const memory of memories) {
    prepared.push(`[${memory.id}] ${memory.category}: ${memory.fact}`);
  }
  return prepared;
}
