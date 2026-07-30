import type { FileSearchResult } from "@tiny-chat/shared/src/features/file/types/file.ts";
import {
	type PathLike,
	PathUtils,
} from "@tiny-chat/shared/src/features/file/utils/PathUtils.ts";
import { Prisma } from "../../../../generated/prisma/client.ts";
import type { FilesystemService } from "./FilesystemService.ts";

/**
 * Search system for skills, uploads, repos, and chat files.
 */
export const FileSearchService = {
	searchFiles: async ({
		filesystem,
		searchText,
		searchEmbedding,
		path = { path: [] },
		mode = "standard",
		limit,
	}: {
		filesystem: FilesystemService;
		searchText: string;
		searchEmbedding?: number[];
		path?: PathLike;
		mode?: "standard" | "grep";
		limit?: number;
	}) => {
		if (mode !== "standard") {
			throw new Error("only standard mode is supported for now");
		}

		const files = filesystem
			.getAllNodes()
			.filter((node) =>
				PathUtils.contains({
					descendent: node.path,
					parent: PathUtils.asPath(path) ?? [],
				}),
			)
			.map((node) => ({
				id: node.chatFile?.id ?? node.uploadFile?.id,
				path: node.path,
			}));

		console.log(
			`searching "${searchText}"${searchEmbedding ? " (with embedding)" : ""} in chat files`,
		);

		const results = await globalThis.prisma.$queryRaw<FileSearchResult[]>`
    WITH search AS (
      SELECT websearch_to_tsquery('english', ${searchText}) AS query
    ),

    embedding_hits AS (
     SELECT
       f.id,
       (f.embedding <=> ${JSON.stringify(searchEmbedding)}) AS distance,
       ROW_NUMBER() OVER (ORDER BY f.embedding <=> ${JSON.stringify(searchEmbedding)}) AS rank
     FROM file f
     WHERE id IN (${Prisma.join(files.map((f) => f.id))})
       AND f.embedding IS NOT NULL
     ORDER BY distance
     LIMIT 200
    ),

    lexicon_hits AS (
      SELECT
        f.id,
        ts_rank_cd(f.lexicon, search.query, 32) AS ts_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(f.lexicon, search.query, 32) DESC) AS rank
      FROM file f
      CROSS JOIN search
		  WHERE id IN (${Prisma.join(files.map((f) => f.id))})
        AND search.query != ''::tsquery
        AND f.lexicon @@ search.query
      ORDER BY ts_score DESC
      LIMIT 200
    ),

    -- Path matching: boost files whose path segments match query words
    path_hits AS (
    SELECT
      f.id,
      -- Score by how many path segments match any query word
      (
        SELECT COUNT(*)::float
        FROM unnest(array_remove(f.path, '')) AS segment
        WHERE to_tsvector('simple', replace(replace(segment, '-', ' '), '_', ' '))
        @@ websearch_to_tsquery('simple', ${searchText})
      ) AS path_match_count
    FROM file f
    WHERE id IN (${Prisma.join(files.map((f) => f.id))})
      AND f.path IS NOT NULL
      AND array_length(array_remove(f.path, ''), 1) > 0
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
      f.id,
      f."uploadId",
      f.path,
      f.data,
      -- Path relevance boost: each matching path segment adds weight
      (c.rrf + COALESCE(p.path_match_count, 0) * 0.005) AS final_score
    FROM combined c
    JOIN file f ON f.id = c.id
    LEFT JOIN path_hits p ON p.id = c.id
    ORDER BY final_score DESC
    LIMIT ${limit}
  `;

		console.log(`found ${results.length} files`);

		return results.filter(
			(uf) =>
				!!uf.chatId ||
				!results.find(
					(cf) =>
						cf.chatId &&
						cf.uploadId === uf.uploadId &&
						PathUtils.equals(cf.path, uf.path),
				),
		);
	},
} as const;
