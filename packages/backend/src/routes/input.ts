import { createId } from "@paralleldrive/cuid2";
import {
	type FileSearchResult,
	zData,
	type zDataPart,
	type zUploadOutput,
} from "@tiny-chat/shared/src/types/chat.ts";
import {
	zToolContext,
	type zToolGroup,
} from "@tiny-chat/shared/src/types/tool.ts";
import type { zUser } from "@tiny-chat/shared/src/types/user.ts";
import { pathEquals } from "@tiny-chat/shared/src/utils/files.ts";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { File } from "../../generated/prisma/client.ts";
import { Prisma, UploadType } from "../../generated/prisma/client.ts";
import type { Upload$filesArgs } from "../../generated/prisma/models/Upload.ts";
import { procedure, router } from "../index.ts";
import { auth } from "../services/auth.ts";
import { handleFiles, handleFilesZipped } from "../services/files.ts";
import { getGenerationCallbacksBackend } from "../services/worker.ts";
import backend from "../tools/index.ts";
import { shouldIncludeFile } from "../utils/files.ts";

interface GitHubRepo {
	id: number;
	full_name: string;
	name: string;
	description: string | null;
	private: boolean;
	html_url: string;
	updated_at: string;
	default_branch: string;
}

async function getGithubToken(userId: string): Promise<string> {
	const result = await auth.api.getAccessToken({
		body: {
			providerId: "github",
			userId,
		},
	});

	if (!result?.accessToken) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "No linked GitHub found",
		});
	}

	return result.accessToken;
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
			if (input.context.chat?.id !== "zzzzzzzzzzzzzzzzzzzzzzzz") {
				await globalThis.prisma.chat.findUniqueOrThrow({
					where: { id: input.context.chat?.id, userId: ctx.session.user.id },
				});
			}
			const tool = backend
				.flatMap((g) => g.tools)
				.find((t) => t.name === input.name);
			if (!tool) throw new Error(`Tool not found: ${input.name}`);
			console.log(
				`Running tool ${input.name} with params ${JSON.stringify(input.input)}`,
			);
			return await tool.run(
				{
					...input.context,
					callbacks: getGenerationCallbacksBackend(ctx.session.user),
				},
				input.input,
				input.userInput,
			);
		}),

	listUploads: procedure
		.input(
			z.object({
				type: z.enum(UploadType),
				includeFiles: z.custom<Upload$filesArgs>().optional(),
				limit: z.number().optional(),
				cursor: z.cuid2().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			let uploads = await globalThis.prisma.upload.findMany({
				where: { userId: ctx.session.user.id, type: input.type },
				include: { files: input.includeFiles },
				orderBy: { createdAt: "desc" },
			});

			if (input.limit) {
				const index = Math.max(
					0,
					uploads.findIndex((u) => u.id === input.cursor),
				);
				const nextCursor =
					index + input.limit < uploads.length
						? uploads[index + input.limit].id
						: null;
				uploads = uploads.slice(index, index + input.limit);
				return { uploads, nextCursor };
			}

			return { uploads, nextCursor: null };
		}),

	createUpload: procedure
		.input(
			z
				.instanceof(FormData)
				.transform((fd) => Object.fromEntries(fd.entries()))
				.pipe(
					z.object({
						type: z.enum(UploadType),
						file: z.file(),
					}),
				),
		)
		.mutation(async ({ ctx, input }): Promise<zUploadOutput> => {
			console.log(`Preparing to handle upload: ${input.file.name}`);

			const id = createId();

			await globalThis.prisma.upload.create({
				data: {
					id,
					user: { connect: { id: ctx.session.user.id } },
					type: input.type,
					name: input.file.name,
				},
			});

			let files: Awaited<ReturnType<typeof handleFiles>>;
			if (input.file.name.endsWith(".zip")) {
				files = await handleFilesZipped(
					ctx.session.user,
					await input.file.arrayBuffer(),
					[],
					id,
				);
			} else {
				files = await handleFiles(
					ctx.session.user,
					[[input.file.name, await input.file.arrayBuffer()]],
					[],
					id,
				);
			}

			const thumbnail = files.find((f) => !!f.thumbnail)?.thumbnail;
			await globalThis.prisma.upload.update({
				where: { id },
				data: {
					thumbnail,
				},
			});

			console.log(
				`Saving files:`,
				files.map((f) => ({
					path: f.path.join("/"),
					mime: f.mime,
					size: f.data.length,
					thumbnail: f.thumbnail?.length ?? -1,
				})),
				`Associated thumbnail: ${thumbnail?.length ?? -1} bytes`,
			);

			return {
				type: "upload",
				id,
				name: input.file.name,
				thumbnail,
			};
		}),

	listAllFilesInChat: procedure
		.input(
			z.object({
				chatId: z.cuid2().optional(),
				uploadIds: z.array(z.cuid2()).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return listAllFilesInChat(
				ctx.session.user,
				input.chatId,
				input.uploadIds,
			);
		}),

	listFilesInChat: procedure
		.input(
			z.object({
				chatId: z.cuid2().optional(),
				uploadIds: z.array(z.cuid2()).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return listFilesInChat(ctx.session.user, input.chatId, input.uploadIds);
		}),

	findFilesInUploads: procedure
		.input(
			z.object({
				files: z.array(
					z.object({ uploadId: z.cuid2(), uploadName: z.string() }),
				),
			}),
		)
		.query(async ({ ctx, input }) => {
			return await Promise.all(
				input.files.map((file) =>
					globalThis.prisma.file.findFirst({
						where: {
							userId: ctx.session.user.id,
							uploadId: file.uploadId,
							path: {
								equals: [file.uploadName],
							},
						},
					}),
				),
			);
		}),

	findFileInChat: procedure
		.input(
			z.object({
				chatId: z.cuid2(),
				uploadId: z.cuid2().nullable(),
				path: z.array(z.string()),
			}),
		)
		.query(async ({ ctx, input }) => {
			const file = await globalThis.prisma.file.findFirst({
				where: {
					userId: ctx.session.user.id,
					chatId: input.chatId,
					uploadId: input.uploadId,
					path: { equals: input.path },
				},
			});

			let uploadFile: File | null = null;
			if (input.uploadId) {
				uploadFile = await globalThis.prisma.file.findFirst({
					where: {
						userId: ctx.session.user.id,
						chatId: null,
						uploadId: input.uploadId,
						path: { equals: input.path },
					},
				});
			}

			return file ?? uploadFile;
		}),

	searchFiles: procedure
		.input(
			z.object({
				chat: z.cuid2().nullish(),
				uploads: z.array(z.cuid2()).nullish(),
				text: z.string(),
				embedding: z.array(z.number()).optional(),
				limit: z.number().optional(),
			}),
		)
		.query(({ ctx, input: { chat, uploads, text, embedding, limit } }) => {
			return searchFiles(
				ctx.session.user,
				text,
				embedding,
				limit,
				chat,
				uploads,
			);
		}),

	deleteUpload: procedure
		.input(z.object({ id: z.cuid2() }))
		.mutation(async ({ ctx, input }) => {
			await globalThis.prisma.upload.delete({
				where: { id: input.id, userId: ctx.session.user.id },
			});
		}),

	listRepos: procedure.query(async ({ ctx }) => {
		const token = await getGithubToken(ctx.session.user.id);

		const pages: GitHubRepo[] = [];
		let page = 1;
		while (true) {
			const res = await fetch(
				`https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: "application/vnd.github+json",
						"X-GitHub-Api-Version": "2026-03-10",
					},
				},
			);
			if (!res.ok) {
				console.error("GitHub API error:", await res.text());
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `GitHub API error: ${res.status} ${res.statusText}`,
				});
			}
			const data = (await res.json()) as GitHubRepo[];
			if (!data.length) break;
			pages.push(...data);
			if (data.length < 100) break;
			page++;
		}

		return pages.map((r) => ({
			id: r.id,
			fullName: r.full_name,
			name: r.name,
			description: r.description,
			private: r.private,
			url: r.html_url,
			updatedAt: r.updated_at,
			defaultBranch: r.default_branch,
		}));
	}),

	cloneRepo: procedure
		.input(
			z.object({ owner: z.string(), repo: z.string(), branch: z.string() }),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const token = await getGithubToken(userId);

			if (
				[input.owner, input.repo, input.branch].some(
					(t) => !/^[\w.-]+$/.test(t),
				)
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid characters",
				});
			}

			const uploadName = `${input.owner}/${input.repo} @ ${input.branch}`;

			console.log(
				`https://api.github.com/repos/${input.owner}/${input.repo}/zipball/${input.branch}`,
			);
			const result = await fetch(
				`https://api.github.com/repos/${input.owner}/${input.repo}/zipball/${input.branch}`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: "application/vnd.github+json",
						"X-GitHub-Api-Version": "2022-11-28",
					},
				},
			);

			if (!result.ok || !result.body) {
				console.error("GitHub API error:", await result.text());
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `GitHub API error: ${result.status} ${result.statusText}`,
				});
			}

			console.log(`Cloning GitHub for upload: ${uploadName}`);

			const existingUpload = await globalThis.prisma.upload.findFirst({
				where: { userId, type: UploadType.GITHUB, name: uploadName },
				include: { files: true },
			});

			const uploadId = existingUpload?.id ?? createId();
			if (!existingUpload) {
				await globalThis.prisma.upload.create({
					data: {
						id: uploadId,
						user: { connect: { id: userId } },
						type: UploadType.GITHUB,
						name: uploadName,
					},
				});
			} else {
				await globalThis.prisma.upload.update({
					where: { id: uploadId },
					data: {
						createdAt: new Date(),
					},
				});
			}

			await handleFilesZipped(
				ctx.session.user,
				await result.arrayBuffer(),
				existingUpload?.files,
				uploadId,
				(path) => shouldIncludeFile(path),
				true,
			);

			return {
				type: "upload",
				id: uploadId,
				name: uploadName,
			} satisfies Extract<zDataPart, { type: "upload" }>;
		}),
});

// ── Shared file-entry types ────────────────────────────────────────────────

export interface FileEntry {
	id: string;
	path: string[];
	uploadId: string | null;
	uploadName: string | null;
	lines: number;
}

/**
 * Resolves the set of uploadIds referenced in a chat's messages when not
 * supplied explicitly.
 */
async function resolveUploadIds(
	userId: string,
	chatId: string,
): Promise<string[]> {
	const messages = await globalThis.prisma.message.findMany({
		where: { userId, chatId },
		select: { data: true },
	});
	return messages.flatMap((m) =>
		zData
			.parse(m.data)
			.flat()
			.flatMap((part) => (part.type === "upload" ? [part.id] : [])),
	);
}

/**
 * Returns all files relevant to a chat, pairing each chat-version of a file
 * with its original upload-version (when both exist). Each entry contains
 * only the fields needed for display and context-building: id, path, uploadId,
 * uploadName, and lines.
 *
 * Shape: Record<uploadId | '', { file?: FileEntry; uploadFile?: FileEntry }[]>
 */
export async function listAllFilesInChat(
	user: zUser,
	chatId?: string,
	uploadIds?: string[],
) {
	if (!uploadIds && chatId) {
		uploadIds = await resolveUploadIds(user.id, chatId);
	}

	// One SQL pass: FULL OUTER JOIN chat files ↔ upload files on (uploadId, path).
	// try_decode_utf8 converts the bytea data to text so we can count newlines;
	// non-text files will return NULL and get 0 lines.
	const rows = await globalThis.prisma.$queryRaw<
		{
			file_id: string | null;
			file_path: string[] | null;
			file_lines: bigint | null;
			upload_file_id: string | null;
			upload_file_path: string[] | null;
			upload_file_lines: bigint | null;
			upload_id: string | null;
			upload_name: string | null;
		}[]
	>`
    WITH
      chat_files AS (
        SELECT
          f.id,
          f.path,
          f."uploadId",
          COALESCE(
            array_length(
              string_to_array(try_decode_utf8(f.data), E'\n'),
              1
            ) - 1,
            0
          ) AS lines,
          u.name AS upload_name
        FROM file f
        LEFT JOIN upload u ON u.id = f."uploadId"
        WHERE f."userId" = ${user.id}
          AND f."chatId" = ${chatId ?? null}
          AND ${chatId !== undefined ? Prisma.sql`f."chatId" IS NOT NULL` : Prisma.sql`FALSE`}
      ),
      upload_files AS (
        SELECT
          f.id,
          f.path,
          f."uploadId",
          COALESCE(
            array_length(
              string_to_array(try_decode_utf8(f.data), E'\n'),
              1
            ) - 1,
            0
          ) AS lines,
          u.name AS upload_name
        FROM file f
        LEFT JOIN upload u ON u.id = f."uploadId"
        WHERE f."userId" = ${user.id}
          AND f."chatId" IS NULL
          AND (
            ${uploadIds && uploadIds.length > 0 ? Prisma.sql`f."uploadId" = ANY(${uploadIds}::text[])` : Prisma.sql`FALSE`}
          )
      )
    SELECT
      cf.id            AS file_id,
      cf.path          AS file_path,
      cf.lines         AS file_lines,
      uf.id            AS upload_file_id,
      uf.path          AS upload_file_path,
      uf.lines         AS upload_file_lines,
      COALESCE(cf."uploadId", uf."uploadId") AS upload_id,
      COALESCE(cf.upload_name, uf.upload_name) AS upload_name
    FROM chat_files cf
    FULL OUTER JOIN upload_files uf
      ON cf."uploadId" = uf."uploadId"
     AND cf.path = uf.path
  `;

	const merged: Record<string, { file?: FileEntry; uploadFile?: FileEntry }[]> =
		{};

	for (const row of rows) {
		const key = row.upload_id ?? "";
		merged[key] ??= [];

		const file: FileEntry | undefined = row.file_id
			? {
					id: row.file_id,
					path: row.file_path ?? [],
					uploadId: row.upload_id,
					uploadName: row.upload_name,
					lines: Number(row.file_lines ?? 0),
				}
			: undefined;

		const uploadFile: FileEntry | undefined = row.upload_file_id
			? {
					id: row.upload_file_id,
					path: row.upload_file_path ?? [],
					uploadId: row.upload_id,
					uploadName: row.upload_name,
					lines: Number(row.upload_file_lines ?? 0),
				}
			: undefined;

		merged[key].push({ file, uploadFile });
	}

	return merged;
}

/**
 * Flattens listAllFilesInChat into a simple Record<uploadId | '', FileEntry[]>,
 * preferring the chat-version of each file over the upload-version.
 */
export async function listFilesInChat(
	user: zUser,
	chatId?: string,
	uploadIds?: string[],
) {
	const allFiles = await listAllFilesInChat(user, chatId, uploadIds);
	return Object.fromEntries(
		Object.entries(allFiles).map(([uploadId, pairs]) => [
			uploadId,
			pairs
				.map(({ file, uploadFile }) => file ?? uploadFile)
				.filter(Boolean) as FileEntry[],
		]),
	);
}

export async function searchFiles(
	user: zUser,
	text: string,
	embedding?: number[],
	limit = 5,
	chatId?: string | null,
	uploadIds?: string[] | null,
	path: string[] = [],
): Promise<FileSearchResult[]> {
	console.log(
		`Searching for "${text}"${embedding ? " (+embedding)" : ""} in all files in chat`,
	);

	path = path.filter((part) => part.length);

	const results = await globalThis.prisma.$queryRaw<FileSearchResult[]>`
    WITH search AS (
      SELECT websearch_to_tsquery('english', ${text}) AS query
    ),

    embedding_hits AS (
     SELECT
       f.id,
       (f.embedding <=> ${JSON.stringify(embedding)}) AS distance,
       ROW_NUMBER() OVER (ORDER BY f.embedding <=> ${JSON.stringify(embedding)}) AS rank
     FROM file f
     WHERE f."userId" = ${user.id}
       AND (${chatId ? Prisma.sql`f."chatId" = ${chatId}` : Prisma.sql`1=1`})
       AND (${uploadIds ? Prisma.sql`f."uploadId" IN (${Prisma.join(uploadIds)})` : Prisma.sql`1=1`})
       AND (${path.length ? Prisma.sql`array_remove(f.path, '')[1:${path.length}] = ${path}` : Prisma.sql`1=1`})
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
      WHERE f."userId" = ${user.id}
        AND (${chatId ? Prisma.sql`f."chatId" = ${chatId}` : Prisma.sql`1=1`})
        AND (${uploadIds ? Prisma.sql`f."uploadId" IN (${Prisma.join(uploadIds)})` : Prisma.sql`1=1`})
        AND (${path.length ? Prisma.sql`array_remove(f.path, '')[1:${path.length}] = ${path}` : Prisma.sql`1=1`})
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
        @@ websearch_to_tsquery('simple', ${text})
      ) AS path_match_count
    FROM file f
    WHERE f."userId" = ${user.id}
      AND (${chatId ? Prisma.sql`f."chatId" = ${chatId}` : Prisma.sql`1=1`})
      AND (${uploadIds ? Prisma.sql`f."uploadId" IN (${Prisma.join(uploadIds)})` : Prisma.sql`1=1`})
      AND (${path.length ? Prisma.sql`array_remove(f.path, '')[1:${path.length}] = ${path}` : Prisma.sql`1=1`})
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

	console.log(`Found ${results.length} files`);

	return results.filter(
		(uf) =>
			!!uf.chatId ||
			!results.find(
				(cf) =>
					cf.chatId &&
					cf.uploadId === uf.uploadId &&
					pathEquals(cf.path, uf.path),
			),
	);
}
