type Hit = { id: string };
type RankedHit = Hit & { score: number };

export const SearchUtils = {
	// Full transcripts can produce thousands of repeated BM25/fuzzy clauses.
	// Keep the first distinct words and skip oversized identifiers/payloads.
	lexicalText: (text: string) => {
		const words = new Set<string>();
		for (const [word] of text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/gu)) {
			if (word.length > 64) continue;
			words.add(word.toLowerCase());
			if (words.size === 32) break;
		}
		return [...words].join(" ");
	},

	// Fuzzing short words creates many unrelated hits in natural-language queries.
	fuzzyText: (text: string) =>
		(text.match(/[\p{L}\p{N}]{4,}/gu) ?? []).join(" "),

	// Missing, zero, or invalid vectors must still allow lexical retrieval.
	embedding: (value?: number[]) =>
		value?.length && value.every(Number.isFinite) && value.some((n) => n !== 0)
			? value
			: undefined,

	// Exact and fuzzy are overlapping lexical channels: take their maximum,
	// rather than counting the same lexical evidence twice. Semantic agreement
	// adds an independent vote. BM25 and cosine scores need no shared scale.
	fuse: (exact: Hit[], fuzzy: Hit[], semantic: Hit[]): RankedHit[] => {
		const scores = new Map<string, number>();
		for (const [hits, weight] of [
			[exact, 1],
			[fuzzy, 0.5],
		] as const) {
			hits.forEach((hit, i) => {
				scores.set(
					hit.id,
					Math.max(scores.get(hit.id) ?? 0, weight / (30 + i + 1)),
				);
			});
		}
		semantic.forEach((hit, i) => {
			scores.set(hit.id, (scores.get(hit.id) ?? 0) + 1 / (30 + i + 1));
		});
		return [...scores]
			.map(([id, score]) => ({ id, score }))
			.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
	},

	diversify: <T extends Hit>(
		items: T[],
		ranks: RankedHit[],
		group: (item: T) => string,
	): T[] => {
		const scores = new Map(ranks.map((row) => [row.id, row.score]));
		const counts = new Map<string, number>();
		const remaining = [...items];
		const result: T[] = [];
		const score = (item: T) =>
			(scores.get(item.id) ?? 0) / (1 + 0.5 * (counts.get(group(item)) ?? 0));
		while (remaining.length) {
			remaining.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
			const item = remaining.shift();
			if (!item) break;
			result.push(item);
			counts.set(group(item), (counts.get(group(item)) ?? 0) + 1);
		}
		return result;
	},
} as const;
