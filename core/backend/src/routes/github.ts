import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { procedure, router } from '../index.ts';
import type { Unzipped } from 'fflate';
import { unzip } from 'fflate';
import { embed } from '../utils/embed.ts';
import { createId } from '@paralleldrive/cuid2';
import { fileTypeFromBuffer } from 'file-type';
import type { zDataPart } from '../types.ts';

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
  const account = await globalThis.prisma.account.findFirst({
    where: { userId, providerId: 'github' },
  });
  if (!account?.accessToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'GitHub not linked',
    });
  }
  return account.accessToken;
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

      const upload = await prisma.upload.create({
        data: {
          id: createId(),
          user: { connect: { id: userId } },
          name: `GitHub: ${input.owner}/${input.repo} @ ${input.branch}`,
        },
      });

      const files = await Promise.all(
        Object.entries(unzipped).map(async ([path, content]) =>
          prisma.file.create({
            data: {
              id: createId(),
              user: { connect: { id: userId } },
              upload: { connect: { id: upload.id } },
              path: path.split('/').slice(1),
              mime: (await fileTypeFromBuffer(content))?.mime ?? 'application/octet-stream',
              data: new Uint8Array(content),
            },
          }),
        ),
      );

      console.log(`Saved ${files.length} file(s) to database, starting embedding...`);
      void (async () => {
        for (let i = 0; i < files.length; i += 100) {
          console.log(`Generating embeddings for files ${i}-${Math.min(i + 100, files.length)}`);
          const i2 = Math.min(i + 100, files.length);
          const embeddings = await embed(
            ctx.session.user,
            files.slice(i, i2).map((f) => new TextDecoder().decode(f.data)),
          );
          if (!embeddings) {
            console.log(`Failed to generate embeddings for files ${i}-${i2}`);
            continue;
          }
          console.log(`Generated embeddings for files ${i}-${i2}`);
          await ctx.prisma.$transaction(async (tx) => {
            for (let j = 0; j < embeddings.length; j++) {
              await tx.$executeRaw`UPDATE file SET embedding = ${JSON.stringify(embeddings[j])}::vector WHERE id = ${files[i + j].id}`;
            }
          });
        }
      })();

      return {
        type: 'upload',
        id: upload.id,
        name: upload.name,
      } satisfies Extract<zDataPart, { type: 'upload' }>;
    }),
});
