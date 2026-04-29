import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { procedure, router } from '../index.ts';
import type { Unzipped } from 'fflate';
import { unzip } from 'fflate';
import { embed } from '../utils/embed.ts';
import { createId } from '@paralleldrive/cuid2';
import { fileTypeFromBuffer } from 'file-type';
import type { zDataPart } from '../types.ts';
import { shouldEmbedFile, includeGitHubFile } from '../utils/consts.ts';
import { auth } from '../server.ts';
import { type File, Prisma } from '../../generated/prisma/client.ts';

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
  list: procedure.query(async ({ ctx }) => {
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

  clone: procedure
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

      const buffer = await result.arrayBuffer();
      const unzipped = await new Promise<Unzipped>((resolve, reject) => {
        unzip(new Uint8Array(buffer), (err, data) => {
          if (err) {
            console.error('Unzip error:', err);
            reject(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to unzip repository',
              }),
            );
          } else {
            resolve(data);
          }
        });
      });

      console.log(`Unzipped ${Object.keys(unzipped).length} file(s) from repo`);

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

      const zipFiles = Object.entries(unzipped).filter(([path]) => includeGitHubFile(path));
      const existingFilesMap = new Map(
        existingUpload?.files.map((f) => [f.path.join('/'), f]) ?? [],
      );

      const toCreate: { path: string[]; mime: string; data: Uint8Array }[] = [];
      const toUpdate: { id: string; data: Uint8Array; mime: string }[] = [];
      const processedPaths = new Set<string>();

      for (const [rawPath, content] of zipFiles) {
        const pathParts = rawPath.split('/').slice(1);
        const pathKey = pathParts.join('/');
        processedPaths.add(pathKey);

        const existingFile = existingFilesMap.get(pathKey);
        const mime = (await fileTypeFromBuffer(content))?.mime ?? 'application/octet-stream';

        if (!existingFile) {
          toCreate.push({ path: pathParts, mime, data: content });
        } else {
          // Compare binary data
          const isChanged =
            Buffer.compare(Buffer.from(existingFile.data), Buffer.from(content)) !== 0;
          if (isChanged) {
            toUpdate.push({ id: existingFile.id, data: content, mime });
          }
        }
      }

      const toDelete =
        existingUpload?.files
          .filter((f) => !processedPaths.has(f.path.join('/')))
          .map((f) => f.id) ?? [];

      console.log(
        `Incremental sync: ${toCreate.length} to create, ${toUpdate.length} to update, ${toDelete.length} to delete`,
      );

      await globalThis.prisma.$transaction([
        ...toCreate.map((f) =>
          globalThis.prisma.file.create({
            data: {
              id: createId(),
              userId,
              uploadId,
              path: f.path,
              mime: f.mime,
              data: new Uint8Array(f.data),
            },
          }),
        ),
        ...toUpdate.map((f) =>
          globalThis.prisma.file.update({
            where: { id: f.id },
            data: {
              data: new Uint8Array(f.data),
              mime: f.mime,
            },
          }),
        ),
        ...toDelete.map((id) =>
          globalThis.prisma.file.delete({
            where: { id },
          }),
        ),
      ]);

      if (toUpdate.length > 0) {
        await globalThis.prisma
          .$executeRaw`UPDATE file SET embedding = NULL WHERE id IN (${Prisma.join(toUpdate.map((u) => u.id))})`;
      }

      const allFiles = (
        await globalThis.prisma.$queryRaw<
          File[]
        >`SELECT id, path, data FROM file WHERE "uploadId" = ${uploadId} AND embedding IS NULL`
      ).filter((f) => shouldEmbedFile(f.path.join('/'), f.data));

      console.log(`Starting embedding for ${allFiles.length} files...`);
      void (async () => {
        for (let i = 0; i < allFiles.length; i += 100) {
          const chunk = allFiles.slice(i, i + 100);
          console.log(`Generating embeddings for files ${i}-${i + chunk.length}`);
          const embeddings = await embed(
            ctx.session.user,
            chunk.map((f) => new TextDecoder().decode(f.data)),
          );
          if (!embeddings) {
            console.log(`Failed to generate embeddings for chunk starting at ${i}`);
            continue;
          }
          await globalThis.prisma.$transaction(
            embeddings.map(
              (emb, j) =>
                globalThis.prisma
                  .$executeRaw`UPDATE file SET embedding = ${JSON.stringify(emb)}::vector WHERE id = ${chunk[j].id}`,
            ),
          );
        }
      })();

      return {
        type: 'upload',
        id: uploadId,
        name: uploadName,
      } satisfies Extract<zDataPart, { type: 'upload' }>;
    }),
});
