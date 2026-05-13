import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createId } from '@paralleldrive/cuid2';
import type { zDataPart } from '@tiny-chat/shared/src/types/chat.ts';
import { auth } from '../services/auth.ts';
import { procedure, router } from '../index.ts';
import { handleFilesZipped } from '../services/files.ts';
import { shouldIncludeFile } from '../utils.ts';

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
      );

      return {
        type: 'upload',
        id: uploadId,
        name: uploadName,
      } satisfies Extract<zDataPart, { type: 'upload' }>;
    }),
});
