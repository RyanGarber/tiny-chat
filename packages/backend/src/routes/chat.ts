import { createId } from "@paralleldrive/cuid2";
import type { ChatSearchResult } from "@tiny-chat/shared/src/types/chat.ts";
import { zConfig, zData, zMetadata } from "@tiny-chat/shared/src/types/chat.ts";
import type { zUser } from "@tiny-chat/shared/src/types/user.ts";
import { z } from "zod";
import type { Chat } from "../../generated/prisma/client.ts";
import type { MessageCreateInput } from "../../generated/prisma/models/Message.ts";
import { procedure, router } from "../index.ts";
import { reorder } from "./message.ts";

export async function createFolder(
	userId: string,
	temporary: boolean,
	incognito: boolean,
	message: MessageCreateInput,
) {
	const id = createId();
	return globalThis.prisma.folder.create({
		data: {
			id,
			user: { connect: { id: userId } },
			chats: {
				create: {
					id: createId(),
					user: { connect: { id: userId } },
					temporary,
					incognito,
					messages: {
						create: {
							...message,
							folder: { connect: { id } },
						},
					},
				},
			},
		},
		include: { chats: { include: { messages: true } } },
	});
}

export default router({
	find: procedure
		.input(
			z.object({ id: z.cuid2().nullish(), messageId: z.cuid2().optional() }),
		)
		.query(async ({ ctx, input }) => {
			if (input.id) {
				return globalThis.prisma.chat.findUnique({
					where: { id: input.id, userId: ctx.session.user.id },
					include: { messages: { select: { createdAt: true } } },
				});
			} else if (input.messageId) {
				return (
					(
						await globalThis.prisma.message.findUnique({
							where: { id: input.messageId, userId: ctx.session.user.id },
							include: {
								chat: {
									include: { messages: { select: { createdAt: true } } },
								},
							},
						})
					)?.chat ?? null
				);
			}
			return null;
		}),

	edit: procedure
		.input(z.object({ id: z.cuid2(), title: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const chat = await globalThis.prisma.chat.findUniqueOrThrow({
				where: { id: input.id, userId: ctx.session.user.id },
				select: { title: true, folder: { select: { id: true, title: true } } },
			});
			await globalThis.prisma.chat.update({
				where: { id: input.id },
				data: {
					title: input.title,
					...(chat.folder.title === chat.title
						? { folder: { update: { title: input.title } } }
						: {}),
				},
			});
		}),

	clone: procedure
		.input(
			z.object({ id: z.cuid2(), untilMessageId: z.cuid2(), title: z.string() }),
		)
		.mutation(async ({ ctx, input }): Promise<Chat> => {
			const chat = await globalThis.prisma.chat.findUniqueOrThrow({
				where: { id: input.id, userId: ctx.session.user.id },
				include: { folder: { include: { chats: true } } },
			});
			let messages = reorder(
				await globalThis.prisma.message.findMany({
					where: { chatId: input.id },
				}),
			);

			let reachedMessage = false;
			messages = messages.filter((message) => {
				if (message.id === input.untilMessageId) {
					reachedMessage = true;
					return true;
				} else {
					return !reachedMessage;
				}
			});

			messages.forEach((message) => {
				const id = createId();
				const next = messages.find((m) => m.previousId === message.id);
				if (next) next.previousId = id;
				message.id = id;
				delete (message as any).chatId;
			});

			if (chat.folder.chats.length === 1) {
				await globalThis.prisma.folder.update({
					where: { id: chat.folderId },
					data: {
						title: chat.title,
					},
				});
			}

			return globalThis.prisma.chat.create({
				data: {
					id: createId(),
					user: { connect: { id: chat.userId } },
					folder: { connect: { id: chat.folderId } },
					title: input.title,
					temporary: chat.temporary,
					incognito: chat.incognito,
					messages: {
						createMany: {
							data: messages.map((message) => ({
								...message,
								config: zConfig.parse(message.config),
								data: zData.parse(message.data),
								metadata: zMetadata.parse(message.metadata),
							})),
						},
					},
				},
			});
		}),

	delete: procedure
		.input(z.object({ id: z.cuid2() }))
		.mutation(async ({ ctx, input }) => {
			const chat = await globalThis.prisma.chat.findUniqueOrThrow({
				where: { id: input.id, userId: ctx.session.user.id },
				include: {
					folder: { select: { chats: { select: { _count: true } } } },
				},
			});
			if (chat.folder.chats.length === 1)
				await globalThis.prisma.folder.delete({ where: { id: chat.folderId } });
			else await globalThis.prisma.chat.delete({ where: { id: input.id } });
		}),

	search: procedure
		.input(
			z.object({
				text: z.string().optional(),
				embedding: z.array(z.number()).optional(),
				limit: z.number().optional(),
				cursor: z.string().optional(),
			}),
		)
		.query(
			async ({
				ctx,
				input,
			}): Promise<{
				results: ChatSearchResult[];
				nextCursor: string | null;
			}> => {
				return searchChats(
					ctx.session.user,
					input.text,
					input.embedding,
					input.limit,
					input.cursor,
				);
			},
		),

	list: procedure
		.input(
			z.object({ cursor: z.cuid2().optional(), limit: z.number().optional() }),
		)
		.query(async ({ ctx, input }) => {
			// TODO move ordering to 'lastActivity' column?
			let folders = await globalThis.prisma.folder.findMany({
				where: {
					userId: ctx.session.user.id,
					chats: { some: { temporary: false } },
				},
				include: {
					chats: {
						where: { temporary: false },
						include: { messages: { select: { createdAt: true } } },
					},
				},
			});

			folders
				.sort((a, b) => {
					const aLatest = Math.max(
						...a.chats.map((item) =>
							Math.max(
								item.createdAt.getTime(),
								...item.messages.map((item) => item.createdAt.getTime()),
							),
						),
					);
					const bLatest = Math.max(
						...b.chats.map((item) =>
							Math.max(
								item.createdAt.getTime(),
								...item.messages.map((item) => item.createdAt.getTime()),
							),
						),
					);
					return bLatest - aLatest;
				})
				.forEach((chat) => {
					chat.chats.sort((a, b) => {
						const aLatest = Math.max(
							a.createdAt.getTime(),
							...a.messages.map((item) => item.createdAt.getTime()),
						);
						const bLatest = Math.max(
							b.createdAt.getTime(),
							...b.messages.map((item) => item.createdAt.getTime()),
						);
						return bLatest - aLatest;
					});
				});

			if (input.limit) {
				const index = Math.max(
					0,
					folders.findIndex((f) => f.id === input.cursor),
				);
				const nextCursor =
					index + input.limit < folders.length
						? folders[index + input.limit].id
						: null;
				folders = folders.slice(index, index + input.limit);
				return { folders, nextCursor };
			}

			return { folders, nextCursor: null };
		}),

	lastActivityMax: procedure.query(async ({ ctx }) => {
		const latestChat = await globalThis.prisma.chat.findFirst({
			where: { userId: ctx.session.user.id, temporary: false },
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
		});
		const latestMessage = await globalThis.prisma.message.findFirst({
			where: { userId: ctx.session.user.id, chat: { temporary: false } },
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
		});
		return Math.max(
			latestChat?.createdAt.getTime() ?? 0,
			latestMessage?.createdAt.getTime() ?? 0,
		);
	}),
});

export async function searchChats(
	user: zUser,
	text?: string,
	embedding?: number[],
	limit = 10,
	cursor?: string,
): Promise<{ results: ChatSearchResult[]; nextCursor: string | null }> {
	console.log(
		`Searching for "${text}"${embedding ? " (+embedding)" : ""} in all chats`,
	);

	let results = await globalThis.prisma.$queryRaw<ChatSearchResult[]>`
    WITH search AS (
      SELECT websearch_to_tsquery('english', ${text}) AS query
    ),

   embedding_hits AS (
     SELECT
       msg.id,
       (msg.embedding <=> ${JSON.stringify(embedding)}) AS distance,
       ROW_NUMBER() OVER (ORDER BY msg.embedding <=> ${JSON.stringify(embedding)}) AS rank
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

	console.log(`Found ${results.length} chats`);

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
}
