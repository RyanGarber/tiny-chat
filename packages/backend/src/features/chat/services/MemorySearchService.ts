import type { MemorySearchResult } from "@tiny-chat/shared/src/features/data/types/memory.ts";
import type { zUser } from "@tiny-chat/shared/src/features/data/types/user.ts";

export const MemorySearchService = {
	searchMemories: async ({
		user,
		searchText,
		searchEmbedding,
		limit = 20,
	}: {
		user: zUser;
		searchText: string;
		searchEmbedding?: number[];
		limit?: number;
	}) => {
		console.log(
			`searching "${searchText}"${searchEmbedding ? " (with embedding)" : ""} in memories`,
		);

		// TODO - 1.5x normal websearch, 0.5x 'OR'-joined search as fallback when embeddings aren't available
		const results = await globalThis.prisma.$queryRaw<MemorySearchResult[]>`
    WITH search AS (
      SELECT websearch_to_tsquery('english', ${searchText}) AS query
    ),

    embedding_hits AS (
      SELECT
        m.id,
        (m.embedding <=> ${JSON.stringify(searchEmbedding)}) AS distance,
        ROW_NUMBER() OVER (ORDER BY m.embedding <=> ${JSON.stringify(searchEmbedding)}) AS rank
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

		console.log(`found ${results.length} memories`);

		return results;
	},
} as const;
