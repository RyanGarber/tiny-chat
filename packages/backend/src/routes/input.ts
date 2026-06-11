import { z } from 'zod';
import type { FileSearchResult, zDataPart, zUploadOutput, } from '@tiny-chat/shared/src/types/chat.ts';
import { type File, Prisma } from '../../generated/prisma/client.ts';
import { procedure, router } from '../index.ts';
import { createId } from '@paralleldrive/cuid2';
import { handleFiles, handleFilesZipped } from '../services/files.ts';
import { TRPCError } from '@trpc/server';
import { shouldIncludeFile } from '../utils.ts';
import { auth } from '../services/auth.ts';
import type { zUser } from '@tiny-chat/shared/src/types/user.ts';

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
      providerId: 'github',
      userId,
    },
  });

  if (!result?.accessToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No linked GitHub found',
    });
  }

  return result.accessToken;
}

export default router({
  listUploads: procedure
    .input(
      z.object({
        is: z.string().optional(),
        isNot: z.string().optional(),
        limit: z.number().optional(),
        cursor: z.cuid2().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let uploads = await globalThis.prisma.upload.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (input.is) {
        uploads = uploads.filter((u) =>
          u.name.toLowerCase().startsWith(`${input.is!.toLowerCase()}:`),
        );
      }

      if (input.isNot) {
        uploads = uploads.filter(
          (u) => !u.name.toLowerCase().startsWith(`${input.isNot!.toLowerCase()}:`),
        );
      }

      if (input.limit) {
        const index = Math.max(
          0,
          uploads.findIndex((u) => u.id === input.cursor),
        );
        const nextCursor =
          index + input.limit < uploads.length ? uploads[index + input.limit].id : null;
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
            type: z.enum(['upload', 'skill']),
            file: z.file(),
          }),
        ),
    )
    .mutation(async ({ ctx, input }): Promise<zUploadOutput> => {
      console.log(`Preparing to handle upload: ${input.file.name}`);

      const id = createId();
      let associate: { uploadId: string } | { skillId: string };

      if (input.type === 'upload') {
        associate = { uploadId: id };
        await globalThis.prisma.upload.create({
          data: {
            id,
            user: { connect: { id: ctx.session.user.id } },
            name: input.file.name,
          },
        });
      } else if (
        input.type === 'skill' &&
        (input.file.name === 'SKILL.md' || input.file.name.endsWith('.zip'))
      ) {
        // TODO - incrementally update baased on matching name in frontmatter
        associate = { skillId: id };
        await globalThis.prisma.skill.create({
          data: {
            id,
            user: { connect: { id: ctx.session.user.id } },
          },
        });
      } else {
        throw new Error(`Invalid upload type: ${input.type as string}`);
      }

      let files: Awaited<ReturnType<typeof handleFiles>>;
      if (input.file.name.endsWith('.zip')) {
        files = await handleFilesZipped(
          ctx.session.user,
          await input.file.arrayBuffer(),
          [],
          associate,
        );
      } else {
        files = await handleFiles(
          ctx.session.user,
          [[input.file.name, await input.file.arrayBuffer()]],
          [],
          associate,
        );
      }

      const thumbnail = files.find((f) => !!f.thumbnail)?.thumbnail;

      console.log(
        `Saving files:`,
        files.map((f) => ({
          path: f.path.join('/'),
          mime: f.mime,
          size: f.data.length,
          thumbnail: f.thumbnail?.length ?? -1,
        })),
        `Associated thumbnail: ${thumbnail?.length ?? -1} bytes`,
      );

      if (input.type === 'upload') {
        await globalThis.prisma.upload.update({
          where: { id },
          data: {
            thumbnail,
          },
        });
      }

      return {
        type: 'upload',
        id,
        name: input.file.name,
        thumbnail,
      };
    }),

  listUploadFiles: procedure
    .input(z.object({ id: z.cuid2() }))
    .query(async ({ ctx, input }): Promise<File[]> => {
      return (
        await globalThis.prisma.upload.findUniqueOrThrow({
          where: { userId: ctx.session.user.id, id: input.id },
          include: { files: true },
        })
      ).files;
    }),

  searchUploads: procedure
    .input(
      z.object({
        uploads: z.array(z.cuid2()),
        text: z.string(),
        embedding: z.array(z.number()).optional(),
        limit: z.number().optional(),
      }),
    )
    .query(({ ctx, input: { uploads, text, embedding, limit } }) => {
      return searchFiles(ctx.session.user, uploads, text, embedding, limit);
    }),

  deleteFiles: procedure
    .input(z.object({ type: z.enum(['upload', 'skill']), id: z.cuid2() }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === 'upload') {
        await globalThis.prisma.upload.delete({
          where: { id: input.id, userId: ctx.session.user.id },
        });
      } else {
        await globalThis.prisma.skill.delete({
          where: { id: input.id, userId: ctx.session.user.id },
        });
      }
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
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2026-03-10',
          },
        },
      );
      if (!res.ok) {
        console.error('GitHub API error:', await res.text());
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
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
    .input(z.object({ owner: z.string(), repo: z.string(), branch: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const token = await getGithubToken(userId);

      if ([input.owner, input.repo, input.branch].some((t) => !/^[\w.-]+$/.test(t))) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid characters' });
      }

      const uploadName = `GitHub: ${input.owner}/${input.repo} @ ${input.branch}`;

      console.log(
        `https://api.github.com/repos/${input.owner}/${input.repo}/zipball/${input.branch}`,
      );
      const result = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/zipball/${input.branch}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      if (!result.ok || !result.body) {
        console.error('GitHub API error:', await result.text());
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `GitHub API error: ${result.status} ${result.statusText}`,
        });
      }

      console.log(`Cloning ${input.owner}/${input.repo}@${input.branch} for user ${userId}`);

      const existingUpload = await globalThis.prisma.upload.findFirst({
        where: { userId, name: uploadName },
        include: { files: true },
      });

      const uploadId = existingUpload?.id ?? createId();
      if (!existingUpload) {
        await globalThis.prisma.upload.create({
          data: {
            id: uploadId,
            user: { connect: { id: userId } },
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
        { uploadId },
        (path) => shouldIncludeFile(path),
        true,
      );

      return {
        type: 'upload',
        id: uploadId,
        name: uploadName,
      } satisfies Extract<zDataPart, { type: 'upload' }>;
    }),
});

export async function searchFiles(
  user: zUser,
  uploads: string[],
  text: string,
  embedding?: number[],
  limit = 5,
): Promise<FileSearchResult[]> {
  console.log(`Searching for "${text}"${embedding ? ' (+embedding)' : ''} in all files in chat`);

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
       AND f."uploadId" IN (${Prisma.join(uploads)})
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
        AND f."uploadId" IN (${Prisma.join(uploads)})
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
        FROM unnest(f.path) AS segment
        WHERE to_tsvector('simple', replace(replace(segment, '-', ' '), '_', ' '))
        @@ websearch_to_tsquery('simple', ${text})
      ) AS path_match_count
    FROM file f
    WHERE f."userId" = ${user.id}
      AND f."uploadId" IN (${Prisma.join(uploads)})
      AND f.path IS NOT NULL
      AND array_length(f.path, 1) > 0
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
      u.name AS "uploadName",
      f.path,
      f.data,
      -- Path relevance boost: each matching path segment adds weight
      (c.rrf + COALESCE(p.path_match_count, 0) * 0.005) AS final_score
    FROM combined c
    JOIN file f ON f.id = c.id
    LEFT JOIN upload u on f."uploadId" = u.id
    LEFT JOIN path_hits p ON p.id = c.id
    ORDER BY final_score DESC
    LIMIT ${limit}
  `;

  console.log(`Found ${results.length} files`);

  return results;
}
