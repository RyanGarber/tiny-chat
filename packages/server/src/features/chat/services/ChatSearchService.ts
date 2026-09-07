import type { MessageSearchResult } from "@tiny-chat/core/src/features/data/types/message.ts";
import type { zUser } from "@tiny-chat/core/src/features/data/types/user.ts";
import { VERBOSE } from "@tiny-chat/core/src/logger.ts";
import { SearchUtils } from "../utils/SearchUtils.ts";

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
		searchText: string;
		searchEmbedding?: number[];
		limit?: number;
		cursor?: string;
	}): Promise<{
		results: MessageSearchResult[];
		nextCursor: string | null;
	}> => {
		if (VERBOSE)
			console.log(
				`searching "${searchText}"${searchEmbedding ? " (with embedding)" : ""} in chats`,
			);

		const db = globalThis.db;
		const text = SearchUtils.lexicalText(searchText);
		const fuzzyText = SearchUtils.fuzzyText(text);
		const embedding = SearchUtils.embedding(searchEmbedding);
		const lexical = (fuzzy: boolean) =>
			db.sql.public.message
				.select((f, fns) => ({
					id: f.id,
					score: fns.raw`pdb.score(${f.id})`.returns("pg/float4@1"),
				}))
				.where((f, fns) =>
					fns.and(
						fns.eq(f.userId, user.id),
						fns.paradeDbMatchAny(
							fns.raw`COALESCE(try_extract_text(${f.data}), '')`.returns(
								"pg/text@1",
							),
							fuzzy ? fns.paradeDbFuzzy(fuzzyText, 1) : text,
						),
					),
				)
				.orderBy(
					(f, fns) => fns.raw`pdb.score(${f.id})`.returns("pg/float4@1"),
					{ direction: "desc" },
				)
				.orderBy((f) => f.id, { direction: "asc" })
				.limit(200)
				.build();
		const [exact, fuzzy, semantic] = await Promise.all([
			text ? db.runtime().query(lexical(false)).toArray() : [],
			fuzzyText ? db.runtime().query(lexical(true)).toArray() : [],
			embedding
				? db
						.runtime()
						.query(
							db.sql.public.message
								.select((f, fns) => ({
									id: f.id,
									distance:
										fns.raw`CASE WHEN vector_dims(${f.embedding}) = ${embedding.length} THEN ${fns.cosineDistance(f.embedding, embedding)} ELSE NULL END`.returns(
											"pg/float8@1",
										),
								}))
								.where((f, fns) => fns.eq(f.userId, user.id))
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
								.limit(200)
								.build(),
						)
						.toArray()
				: [],
		]);
		const rows = SearchUtils.fuse(exact, fuzzy, semantic);

		if (rows.length === 0) return { results: [], nextCursor: null };

		const messages = await globalThis.db.orm.public.Message.where((message) =>
			message.id.in(rows.map((row) => row.id)),
		)
			.select("id", "chatId", "author", "data", "createdAt")
			.include("chat", (chat) => chat.select("title"))
			.all();

		const byId = new Map(messages.map((message) => [message.id, message]));

		let results: MessageSearchResult[] = rows.flatMap((row) => {
			const message = byId.get(row.id);
			if (message) {
				if (message.chat === null)
					throw new Error("TODO TEMP - prisma typing bug");
				return [
					{
						...message,
						chatTitle: message.chat.title,
					},
				];
			}
			return [];
		});

		// Discount repeated chats without hiding additional relevant messages.
		results = SearchUtils.diversify(results, rows, (result) => result.chatId);
		const index = cursor
			? results.findIndex((result) => result.id === cursor)
			: 0;
		if (index < 0) return { results: [], nextCursor: null };
		const size = Math.max(0, Math.floor(limit));
		return {
			results: results.slice(index, index + size),
			nextCursor: size > 0 ? (results[index + size]?.id ?? null) : null,
		};
	},
} as const;
