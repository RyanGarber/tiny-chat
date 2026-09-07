import type { MemorySearchResult } from "@tiny-chat/core/src/features/data/types/memory.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { VERBOSE } from "@tiny-chat/core/src/logger.ts";
import { SearchUtils } from "../utils/SearchUtils.ts";
import { MemoryRetrievalService } from "./MemoryRetrievalService.ts";

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
		const db = globalThis.db;
		const text = SearchUtils.lexicalText(searchText);
		const fuzzyText = SearchUtils.fuzzyText(text);
		const embedding = SearchUtils.embedding(searchEmbedding);
		const lexical = (fuzzy: boolean) =>
			db.sql.public.memory
				.select((f, fns) => ({
					id: f.id,
					score: fns.raw`pdb.score(${f.id})`.returns("pg/float4@1"),
				}))
				.where((f, fns) => {
					const query = fuzzy ? fns.paradeDbFuzzy(fuzzyText, 1) : text;
					return fns.and(
						fns.eq(f.userId, user.id),
						fns.gte(f.confidence, minConfidence),
						fns.or(
							fns.paradeDbMatchAny(
								fns.raw`COALESCE(${f.fact}, '')`.returns("pg/text@1"),
								query,
							),
							// The extension's text-only helper cannot accept text[] evidence.
							fns.raw`${f.evidence} ||| ${query}`.returns("pg/bool@1"),
						),
					);
				})
				.orderBy(
					(f, fns) => fns.raw`pdb.score(${f.id})`.returns("pg/float4@1"),
					{ direction: "desc" },
				)
				.orderBy((f) => f.id, { direction: "asc" })
				.limit(150)
				.build();
		const [exact, fuzzy, semantic] = await Promise.all([
			text ? db.runtime().query(lexical(false)).toArray() : [],
			fuzzyText ? db.runtime().query(lexical(true)).toArray() : [],
			embedding
				? db
						.runtime()
						.query(
							db.sql.public.memory
								.select((f, fns) => ({
									id: f.id,
									distance:
										fns.raw`CASE WHEN vector_dims(${f.embedding}) = ${embedding.length} THEN ${fns.cosineDistance(f.embedding, embedding)} ELSE NULL END`.returns(
											"pg/float8@1",
										),
								}))
								.where((f, fns) =>
									fns.and(
										fns.eq(f.userId, user.id),
										fns.gte(f.confidence, minConfidence),
									),
								)
								.where((f, fns) =>
									fns.raw`CASE WHEN vector_dims(${f.embedding}) = ${embedding.length} THEN ${fns.cosineDistance(f.embedding, embedding)} < 0.65 ELSE false END`.returns(
										"pg/bool@1",
									),
								)
								.orderBy(
									(f, fns) =>
										fns.raw`CASE WHEN vector_dims(${f.embedding}) = ${embedding.length} THEN ${fns.cosineDistance(f.embedding, embedding)} ELSE NULL END`.returns(
											"pg/float8@1",
										),
									{ direction: "asc" },
								)
								.orderBy((f) => f.id, { direction: "asc" })
								.limit(150)
								.build(),
						)
						.toArray()
				: [],
		]);
		const rows = SearchUtils.fuse(exact, fuzzy, semantic);

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

		let results: MemorySearchResult[] = rows.flatMap((row) => {
			const memory = byId.get(row.id);
			return memory
				? [
						{
							...memory,
							evidence: [...memory.evidence],
						},
					]
				: [];
		});

		const scores = new Map(rows.map((row) => [row.id, row.score]));
		results.sort(
			(a, b) =>
				(scores.get(b.id) ?? 0) * Math.max(b.confidence, 0.1) -
					(scores.get(a.id) ?? 0) * Math.max(a.confidence, 0.1) ||
				a.id.localeCompare(b.id),
		);
		// Repeated facts should not consume the limited memory context.
		const seen = new Set<string>();
		results = results.filter((result) => {
			const key = result.fact.toLocaleLowerCase().replace(/\s+/g, " ").trim();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		return MemoryRetrievalService.withinBudget(results, tokens).slice(
			0,
			Math.max(0, Math.floor(limit)),
		);
	},
} as const;
