import type { MessageSearchResult } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";

/**
 * Search system for messages and chats.
 */
export const ChatSearchService = {
	searchChats: async ({
		user,
		searchText,
		searchEmbedding,
		limit = 10,
		cursor,
	}: {
		user: zUser;
		searchText?: string;
		searchEmbedding?: number[];
		limit?: number;
		cursor?: string;
	}): Promise<{
		results: MessageSearchResult[];
		nextCursor: string | null;
	}> => {
		console.log(
			`searching "${searchText}"${searchEmbedding ? " (with embedding)" : ""} in chats`,
		);

		let results = await globalThis.prisma.$queryRaw<MessageSearchResult[]>`
    WITH search AS (
      SELECT websearch_to_tsquery('english', ${searchText}) AS query
    ),

   embedding_hits AS (
     SELECT
       msg.id,
       (msg.embedding <=> ${JSON.stringify(searchEmbedding)}) AS distance,
       ROW_NUMBER() OVER (ORDER BY msg.embedding <=> ${JSON.stringify(searchEmbedding)}) AS rank
     FROM message msg
     WHERE msg."userId" = ${user.id}
       AND msg.embedding IS NOT NULL
     ORDER BY distance
     LIMIT 200
   ),

   lexicon_hits AS (
     SELECT
       msg.id,
       ts_rank_cd(msg.lexicon, search.query, 32) AS ts_score,
       ROW_NUMBER() OVER (ORDER BY ts_rank_cd(msg.lexicon, search.query, 32) DESC) AS rank
     FROM message msg
            CROSS JOIN search
     WHERE msg."userId" = ${user.id}
       AND search.query != ''::tsquery
       AND msg.lexicon @@ search.query
     ORDER BY ts_score DESC
     LIMIT 200
   ),

   combined AS (
     SELECT
       COALESCE(e.id, l.id) AS id,
       COALESCE(1.0 / (60 + e.rank), 0) + COALESCE(1.0 / (60 + l.rank), 0) AS rrf,
       e.distance
     FROM embedding_hits e
            FULL OUTER JOIN lexicon_hits l ON e.id = l.id
   )

  SELECT
    msg.id,
    msg."chatId",
    chat.title AS "chatTitle",
    msg.author,
    msg.data,
    msg."createdAt",
    (
      c.rrf

      -- Recency: messages decay faster than memories (half-life ~60 days)
      -- Floor at 0.5 — old messages can still surface if highly relevant
      * (0.5 + 0.5 * EXP(
        -0.693 * EXTRACT(EPOCH FROM NOW() - msg."createdAt") / (60 * 86400.0)
      ))

      -- Author boost: user messages often carry more intent signal
      * CASE msg.author
        WHEN 'USER'  THEN 1.1
        WHEN 'MODEL' THEN 1.0
      END
    ) AS final_score
  FROM combined c
  JOIN message msg ON msg.id = c.id
  LEFT JOIN chat ON chat.id = msg."chatId"
  ORDER BY final_score DESC
  LIMIT ${limit}
`;

		console.log(`found ${results.length} chats`);

		if (limit) {
			const index = Math.max(
				0,
				results.findIndex((r) => r.id === cursor),
			);
			const nextCursor =
				index + limit < results.length ? results[index + limit].id : null;
			results = results.slice(index, index + limit);
			return { results, nextCursor };
		}

		return { results, nextCursor: null };
	},
} as const;
