import { zToolContext, type zToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import backend from '../tools/index.ts';
import { z } from 'zod';
import { procedure, router } from '../index.ts';
import { getGenerationCallbacksBackend } from '../services/worker.ts';
import { type Action, type Memory, Prisma } from '../../generated/prisma/client.ts';
import { EMBED_FILES } from '../utils.ts';
import { texts } from '@tiny-chat/shared/src/utils.ts';
import type { MemorySearchResult } from '@tiny-chat/shared/src/types/chat.ts';
import { zData } from '@tiny-chat/shared/src/types/chat.ts';
import type { zUser } from '@tiny-chat/shared/src/types/user.ts';

export async function searchMemories(
  user: zUser,
  text?: string,
  embedding?: number[],
  limit = 20,
): Promise<MemorySearchResult[]> {
  console.log(`Searching for "${text}"${embedding ? ' (+embedding)' : ''} in all memories`);

  // TODO - 1.5x normal websearch, 0.5x 'OR'-joined search as fallback when embeddings aren't available
  const results = await globalThis.prisma.$queryRaw<MemorySearchResult[]>`
    WITH search AS (
      SELECT websearch_to_tsquery('english', ${text}) AS query
    ),

    embedding_hits AS (
      SELECT
        m.id,
        (m.embedding <=> ${JSON.stringify(embedding)}) AS distance,
        ROW_NUMBER() OVER (ORDER BY m.embedding <=> ${JSON.stringify(embedding)}) AS rank
      FROM memory m
      WHERE m."userId" = ${user.id}
        AND m.embedding IS NOT NULL
        AND m.confidence >= 0.5
      ORDER BY distance
      LIMIT 150
    ),

    lexicon_hits AS (
      SELECT
        m.id,
        ts_rank_cd(m.lexicon, search.query, 32) AS ts_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(m.lexicon, search.query, 32) DESC) AS rank
      FROM memory m
      CROSS JOIN search
      WHERE m."userId" = ${user.id}
        AND search.query != ''::tsquery
        AND m.lexicon @@ search.query
        AND m.confidence >= 0.5
      ORDER BY ts_score DESC
      LIMIT 150
    ),

    combined AS (
      SELECT
        COALESCE(e.id, l.id) AS id,
        COALESCE(1.2 / (30 + e.rank), 0) + COALESCE(0.8 / (30 + l.rank), 0) AS rrf,
        -- Preserve raw embedding distance for tie-breaking
        e.distance
      FROM embedding_hits e
      FULL OUTER JOIN lexicon_hits l ON e.id = l.id
    )

    SELECT
      m.id,
      m.fact,
      m.category,
      m.stability,
      m."createdAt",
      c.rrf AS base_score,
      (
        c.rrf

          -- Confidence: direct multiplier (0.0–1.0 range already)
          * GREATEST(m.confidence, 0.1)

          -- Stability: long-term facts are more likely to be broadly relevant
          * CASE m.stability
              WHEN 'LONG_TERM'   THEN 1.1
              WHEN 'MEDIUM_TERM' THEN 1.0
              WHEN 'SHORT_TERM'  THEN 0.9
          END

          -- Recency: soft exponential decay with stability-aware half-life
          * (0.75 + 0.25 * EXP(
            -0.693 * EXTRACT(EPOCH FROM NOW() - m."createdAt")
            / (
              CASE m.stability
                WHEN 'SHORT_TERM'  THEN  30 * 86400.0
                WHEN 'MEDIUM_TERM' THEN 180 * 86400.0
                WHEN 'LONG_TERM'   THEN 730 * 86400.0
                END
            )
          ))
      ) AS final_score
    FROM combined c
    JOIN memory m ON m.id = c.id
    ORDER BY final_score DESC
    LIMIT ${limit}
  `;

  console.log(`Found ${results.length} results`);

  return results;
}

export async function getEmbedding(user: zUser, { messageId }: { messageId?: string }) {
  let embedding: string | undefined;
  if (messageId) {
    embedding = (
      await globalThis.prisma.$queryRaw<
        { embedding: string }[]
      >`SELECT embedding FROM message WHERE id = ${messageId} AND "userId" = ${user.id}`
    )[0]?.embedding;
  }
  if (embedding) return JSON.parse(embedding) as number[];
}

export default router({
  listTools: procedure.query((): zToolGroup[] => {
    return backend;
  }),

  callTool: procedure
    .input(
      z.object({
        context: zToolContext,
        name: z.string(),
        input: z.any(),
        userInput: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await globalThis.prisma.chat.findUniqueOrThrow({
        where: { id: input.context.chat?.id, userId: ctx.session.user.id },
      });
      const tool = backend.flatMap((g) => g.tools).find((t) => t.name === input.name);
      if (!tool) throw new Error(`Tool not found: ${input.name}`);
      console.log(`Running tool ${input.name} with params ${JSON.stringify(input.input)}`);
      return (await tool.run(
        {
          ...input.context,
          callbacks: getGenerationCallbacksBackend(ctx.session.user),
        },
        input.input,
        input.userInput,
      )) as Promise<z.ZodAny>;
    }),

  listSkills: procedure
    .input(z.object({ withResources: z.boolean().optional() }))
    .query(({ ctx, input }) => {
      return globalThis.prisma.skill.findMany({
        where: { userId: ctx.session.user.id },
        include: { files: input.withResources ? true : { where: { path: { has: 'SKILL.md' } } } },
      });
    }),

  listSkillFiles: procedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return (
      await globalThis.prisma.skill.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.session.user.id },
        include: { files: true },
      })
    ).files;
  }),

  listMemories: procedure.query(async ({ ctx }): Promise<Memory[]> => {
    return globalThis.prisma.memory.findMany({
      where: { userId: ctx.session.user.id },
    });
  }),

  searchMemories: procedure
    .input(
      z.object({
        text: z.string().optional(),
        embedding: z.array(z.number()).optional(),
        limit: z.number().optional(),
      }),
    )
    .query(({ ctx, input: { text, embedding, limit } }) => {
      return searchMemories(ctx.session.user, text, embedding, limit);
    }),

  getEmbedding: procedure
    .input(z.custom<Parameters<typeof getEmbedding>[1]>())
    .query(async ({ ctx, input }) => {
      return getEmbedding(ctx.session.user, input);
    }),

  listActions: procedure.query(async ({ ctx }): Promise<Action[]> => {
    return globalThis.prisma.action.findMany({
      where: { userId: ctx.session.user.id },
    });
  }),

  listMissingEmbeddings: procedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const messages = await globalThis.prisma.$queryRaw<
        { id: string; data: any; total: number }[]
      >`SELECT id, data, COUNT(*) OVER() as total
        FROM message
        WHERE "userId" = ${ctx.session.user.id}
          AND LENGTH((
            SELECT string_agg("dataPart"->>'value', ' ')
            FROM jsonb_array_elements("data") AS "step",
                 jsonb_array_elements("step") AS "dataPart"
            WHERE "dataPart"->>'type' = 'text'
          )) > 0
          AND embedding IS NULL
        ${input.limit ? Prisma.sql`LIMIT ${input.limit}` : Prisma.empty}`;

      let actions: { id: string; data: any; total: number }[] = [];
      if (!input.limit || messages.length < input.limit) {
        actions = await globalThis.prisma.$queryRaw<
          { id: string; data: any; total: number }[]
        >`SELECT id, data, COUNT(*) OVER() as total
        FROM action
        WHERE "userId" = ${ctx.session.user.id}
          AND LENGTH((
            SELECT string_agg("dataPart"->>'value', ' ')
            FROM jsonb_array_elements("data") AS "step",
                 jsonb_array_elements("step") AS "dataPart"
            WHERE "dataPart"->>'type' = 'text'
          )) > 0
          AND embedding IS NULL
        ${input.limit ? Prisma.sql`LIMIT ${input.limit - messages.length}` : Prisma.empty}`;
      }

      let memories: { id: string; fact: string; total: number }[] = [];
      if (!input.limit || messages.length + actions.length < input.limit) {
        memories = await globalThis.prisma.$queryRaw<
          typeof memories
        >`SELECT id, fact, COUNT(*) OVER() as total
          FROM memory
          WHERE "userId" = ${ctx.session.user.id}
            AND LENGTH(fact) > 0
            AND embedding IS NULL
          ${input.limit ? Prisma.sql`LIMIT ${input.limit - messages.length - actions.length}` : Prisma.empty}`;
      }

      let files: { id: string; data: Uint8Array; total: number }[] = [];
      if (!input.limit || messages.length + actions.length + memories.length < input.limit) {
        files = await globalThis.prisma.$queryRaw<
          typeof files
        >`SELECT id, data, COUNT(*) OVER() as total
          FROM file
          WHERE "userId" = ${ctx.session.user.id}
            AND path[cardinality(path)] ILIKE ANY(ARRAY[${Prisma.join(EMBED_FILES.map((e) => `%${e}`))}])
            AND try_decode_utf8(data) IS NOT NULL
            AND embedding IS NULL
          ${input.limit ? Prisma.sql`LIMIT ${input.limit - messages.length - actions.length - memories.length}` : Prisma.empty}`;
      }

      if (!messages.length && !actions.length && !memories.length && !files.length) return null;

      return {
        messages: messages.map((m) => ({ ...m, text: texts(zData.parse(m.data), ' ') })),
        actions: actions.map((a) => ({ ...a, text: texts(zData.parse(a.data), ' ') })),
        memories: memories.map((m) => ({ ...m, text: m.fact })),
        files: files.map((f) => ({ ...f, text: new TextDecoder().decode(f.data) })),
      };
    }),

  saveEmbeddings: procedure
    .input(
      z.array(
        z.object({
          messageId: z.cuid2().optional(),
          actionId: z.cuid2().optional(),
          memoryId: z.cuid2().optional(),
          fileId: z.cuid2().optional(),
          embedding: z.array(z.number()),
        }),
      ),
    )
    .mutation(async ({ input, ctx }) => {
      await globalThis.prisma.$transaction(
        input.flatMap((item) => {
          if (item.messageId) {
            return globalThis.prisma.$executeRaw`
              UPDATE message
              SET embedding = ${JSON.stringify(item.embedding)}::vector
              WHERE id = ${item.messageId}
              AND "userId" = ${ctx.session.user.id}`;
          }
          if (item.actionId) {
            return globalThis.prisma.$executeRaw`UPDATE action
              SET embedding = ${JSON.stringify(item.embedding)}::vector
              WHERE id = ${item.actionId}
              AND "userId" = ${ctx.session.user.id}`;
          }
          if (item.memoryId) {
            return globalThis.prisma.$executeRaw`UPDATE memory
              SET embedding = ${JSON.stringify(item.embedding)}::vector
              WHERE id = ${item.memoryId}
              AND "userId" = ${ctx.session.user.id}`;
          }
          if (item.fileId) {
            return globalThis.prisma.$executeRaw`UPDATE file
              SET embedding = ${JSON.stringify(item.embedding)}::vector
              WHERE id = ${item.fileId}
              AND "userId" = ${ctx.session.user.id}`;
          }
          return [];
        }),
      );
    }),

  resetEmbeddings: procedure.mutation(async ({ ctx }) => {
    await globalThis.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE message
                           SET embedding = NULL
                           WHERE "userId" = ${ctx.session.user.id}`;
      await tx.$executeRaw`UPDATE memory
                           SET embedding = NULL
                           WHERE "userId" = ${ctx.session.user.id}`;
    });
  }),
});
