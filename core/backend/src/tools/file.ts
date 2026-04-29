import { z } from 'zod';
import type { ToolCall, ToolContext } from './index.ts';
import { embed, getMostRelevant } from '../utils/embed.ts';
import { type File, Prisma } from '../../generated/prisma/client.ts';
import { type ContextItem, snippetText } from '../types.ts';
import { shouldEmbedFile } from '../utils/consts.ts';

const SNIPPET_WINDOW = 2500;

function uploads(context: ContextItem[]) {
  return context.flatMap((m) => m.data.filter((d) => d.type === 'upload').map((u) => u.id));
}

const zReadFile = z.object({ path: z.string().describe('The path as seen in the tree.') });

const ReadFile: ToolCall<typeof zReadFile> = {
  name: 'read_file',
  description: 'Read the contents of an uploaded file.',
  parameters: zReadFile.toJSONSchema(),
  schema: zReadFile,
  run: async (context, params) => {
    const pathParts = params.path.split('/').filter(Boolean);

    const file = await globalThis.prisma.file.findFirst({
      where: {
        uploadId: { in: uploads(context.messages) },
        path: { equals: pathParts },
      },
    });

    if (!file) return `File not found: ${params.path}`;

    return Buffer.from(file.data).toString('utf-8');
  },
};

const zSearchFiles = z.object({ query: z.string(), mode: z.enum(['semantic', 'regex']) });

const SearchFiles: ToolCall<typeof zSearchFiles> = {
  name: 'search_files',
  description: 'Search contents across all uploaded files.',
  parameters: zSearchFiles.toJSONSchema(),
  schema: zSearchFiles,
  run: async (context, params) => {
    if (params.mode === 'semantic') {
      const queryEmbeddings = await embed(context.user, [params.query]);
      if (!queryEmbeddings?.[0]) {
        return 'Failed to generate embedding for query.';
      }
      return searchFiles(context.messages, params.query, queryEmbeddings[0]);
    } else if (params.mode === 'regex') {
      const files = (
        await globalThis.prisma.file.findMany({
          where: {
            uploadId: { in: uploads(context.messages) },
          },
        })
      ).filter((f) => shouldEmbedFile(f.path.join('/'), f.data));

      const matches: string[] = [];
      for (const file of files) {
        const text = Buffer.from(file.data).toString('utf-8');
        const lines = text.split('\n');
        lines.forEach((line) => {
          const query = new RegExp(params.query, 'i');
          if (query.test(line)) {
            matches.push(
              `File: ${file.path.join('/')}\n\n${snippetText(text, query, SNIPPET_WINDOW)}`,
            );
          }
        });
      }

      if (!matches.length) {
        return 'No matches found.';
      }

      return matches.join('\n\n---\n\n');
    }
  },
};

export async function searchFiles(
  context: ContextItem[],
  query: string,
  queryEmbedding: number[],
  maxCount?: number,
) {
  const files = await globalThis.prisma.$queryRaw<(File & { embedding: string })[]>`
        SELECT * FROM file
        WHERE "uploadId" IN (${Prisma.join(uploads(context))})
          AND embedding IS NOT NULL`;

  const candidates = files.map((f) => ({
    value: f,
    embedding: JSON.parse(f.embedding) as number[],
  }));

  const mostRelevant = getMostRelevant(queryEmbedding, candidates, { maxCount });

  if (!mostRelevant.length) {
    return 'No relevant files found.';
  }

  return mostRelevant
    .map((res) => {
      const file = res.value as File;
      const text = Buffer.from(file.data).toString('utf-8');
      const snippet = snippetText(text, query, SNIPPET_WINDOW);
      return `File: ${file.path.join('/')}\nRelevance Score: ${res.score.toFixed(3)}\n\n${snippet}`;
    })
    .join('\n\n---\n\n');
}

export default function tools(context: ToolContext): ToolCall[] {
  console.log(`Available uploads in context: ${uploads(context.messages).join(', ')}`);
  if (!uploads(context.messages).length) return [];
  return [ReadFile, SearchFiles];
}
