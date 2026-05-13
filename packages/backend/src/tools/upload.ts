import { z } from 'zod';
import type { zContextItem } from '@tiny-chat/shared/src/types/chat.ts';
import { snippetText } from '@tiny-chat/shared/src/utils.ts';
import { shouldEmbedFile } from '../utils.ts';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { embed } from '@tiny-chat/shared/src/services/chat/embed.ts';
import { searchFiles, SNIPPET_WINDOW } from '../routes/persistence.ts';

const zReadUploadInput = z.object({
  path: z.string().describe('The absolute path of the file to read.'),
});

const zReadUploadOutput = z.object({ path: z.string(), content: z.string() });

const ReadUpload: Tool<typeof zReadUploadInput, typeof zReadUploadOutput> = {
  name: 'read_upload',
  description: 'Read the contents of an uploaded file.',
  input: zReadUploadInput.toJSONSchema(),
  output: zReadUploadOutput.toJSONSchema(),
  run: async ({ generation }, input) => {
    const pathParts = input.path.split('/').filter(Boolean);

    const file = await globalThis.prisma.file.findFirst({
      where: {
        uploadId: { in: uploads(generation.context) },
        path: { equals: pathParts },
      },
    });

    return { path: input.path, content: Buffer.from(file!.data).toString('utf-8') };
  },
};

const zSearchUploadsInput = z.object({ query: z.string(), mode: z.enum(['semantic', 'regex']) });

/*const zSearchUploadsOutput = z.array(z.object({ path: z.string(), content: z.string() }));*/ // TODO
const zSearchUploadsOutput = z.string();

const SearchUploads: Tool<typeof zSearchUploadsInput, typeof zSearchUploadsOutput> = {
  name: 'search_uploads',
  description: 'Search contents across all uploaded files.',
  input: zSearchUploadsInput.toJSONSchema(),
  output: zSearchUploadsOutput.toJSONSchema(),
  run: async ({ user, generation }, input) => {
    let result: Awaited<ReturnType<typeof SearchUploads.run>> = 'No matches found.';

    if (input.mode === 'semantic') {
      const queryEmbeddings = await embed(user, [input.query], process.env);
      if (!queryEmbeddings?.[0]) throw new Error('Failed to generate embedding for query');

      result = await searchFiles(generation.context, input.query, queryEmbeddings[0]);
    } else if (input.mode === 'regex') {
      const files = (
        await globalThis.prisma.file.findMany({
          where: {
            uploadId: { in: uploads(generation.context) },
          },
        })
      ).filter((f) => shouldEmbedFile(f.path.join('/'), f.data));

      const matches: string[] = [];
      for (const file of files) {
        const text = Buffer.from(file.data).toString('utf-8');
        const lines = text.split('\n');
        lines.forEach((line) => {
          const query = new RegExp(input.query, 'i');
          if (query.test(line)) {
            matches.push(
              `File: ${file.path.join('/')}\n\n${snippetText(text, query, SNIPPET_WINDOW)}`,
            );
          }
        });
      }

      if (matches.length) {
        result = matches.join('\n\n---\n\n');
      }
    }

    return result;
  },
};

export const upload: ToolGroup = {
  name: 'upload',
  tools: [ReadUpload, SearchUploads],
  instructions: {
    heading: 'Uploads',
    body: `You have access to files uploaded by the user via the read_upload and search_uploads tools.`,
  },
};

export function uploads(context: zContextItem[]) {
  return context.flatMap((m) =>
    m.data
      .flat()
      .filter((d) => d.type === 'upload')
      .map((u) => u.id),
  );
}
