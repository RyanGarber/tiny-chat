import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { MemorySearchResult } from "@tiny-chat/core/src/features/data/types/memory.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { VERBOSE } from "@tiny-chat/core/src/logger.ts";
import { MemoryBudgetUtils } from "../utils/MemoryBudgetUtils.ts";

export const MemorySearchService = {
	searchMemories: async ({
		user,
		searchText,
		searchEmbedding,
		limit = 20,
		minConfidence = 0,
		tokens = 2_500,
	}: {
		user: zUser;
		searchText: string;
		searchEmbedding?: number[];
		limit?: number;
		minConfidence?: number;
		tokens?: number;
	}) => {
		if (VERBOSE)
			console.log(
				`searching "${searchText}"${searchEmbedding ? " (with embedding)" : ""} in memories`,
			);
		const rows = await globalThis.db
			.runtime()
			.query(
				globalThis.db.raw.sql`
    WITH search AS (
      SELECT to_tsquery('english', COALESCE((SELECT string_agg(quote_literal(term), ' | ') FROM unnest(tsvector_to_array(to_tsvector('english', ${searchText}))) term), '')) AS query
    ),

    embedding_hits AS (
      SELECT
        m.id,
        (m.embedding <=> NULLIF(${searchEmbedding ? JSON.stringify(searchEmbedding) : ""}, '')::vector) AS distance,
        ROW_NUMBER() OVER (ORDER BY m.embedding <=> NULLIF(${searchEmbedding ? JSON.stringify(searchEmbedding) : ""}, '')::vector) AS rank
      FROM memory m
      WHERE m."userId" = ${user.id}
        AND m.embedding IS NOT NULL
        AND (m.embedding <=> NULLIF(${searchEmbedding ? JSON.stringify(searchEmbedding) : ""}, '')::vector) < 0.65
        AND m.confidence >= ${minConfidence}
      ORDER BY distance
      LIMIT 150
    ),

    lexicon_hits AS (
      SELECT
        m.id,
        ts_rank_cd(to_tsvector('english', m.fact), search.query, 32) AS ts_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', m.fact), search.query, 32) DESC, m.id) AS rank
      FROM memory m
      CROSS JOIN search
      WHERE m."userId" = ${user.id}
        AND search.query != ''::tsquery
        AND to_tsvector('english', m.fact) @@ search.query
        AND m.confidence >= ${minConfidence}
      ORDER BY ts_score DESC, m.id
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
    ORDER BY final_score DESC, m.id
    LIMIT ${limit}
  `
					.returnsRow({ id: globalThis.db.sql.public.memory.columns.id })
					.build(),
			)
			.toArray();
		if (!rows.length) return [];
		const memories = await globalThis.db.orm.public.Memory.where({
			userId: user.id,
		})
			.where((m) => m.id.in(rows.map((row) => row.id)))
			.select(
				"id",
				"fact",
				"category",
				"stability",
				"createdAt",
				"evidence",
				"confidence",
			)
			.all();
		const byId = new Map(memories.map((memory) => [memory.id, memory]));
		const results: MemorySearchResult[] = rows.flatMap((row) => {
			const memory = byId.get(row.id);
			return memory
				? [
						{
							...memory,
							evidence: [...memory.evidence],
							createdAt: CommonUtils.toDate(memory.createdAt),
						},
					]
				: [];
		});

		console.log(`found ${results.length} memories`);

		return MemoryBudgetUtils.withinBudget(results, tokens);
	},
} as const;
