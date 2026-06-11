import { z } from 'zod';
import type { FileSearchResult, zContextItem } from '@tiny-chat/shared/src/types/chat.ts';
import { shouldEmbedFile } from '../utils.ts';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { searchFiles } from '../routes/input.ts';
import { snippetText } from '@tiny-chat/shared/src/utils.ts';

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
        uploadId: { in: uploadIds(generation.context) },
        path: { equals: pathParts },
      },
    });

    return { path: input.path, content: Buffer.from(file!.data).toString('utf-8') };
  },
};

const zSearchUploadsInput = z.object({ query: z.string(), mode: z.enum(['semantic', 'regex']) });

const zSearchUploadsOutput = z.array(
  z.object({
    path: z.array(z.string()),
    snippet: z.string(),
    uploadName: z.string(),
  }),
);

const SearchUploads: Tool<typeof zSearchUploadsInput, typeof zSearchUploadsOutput> = {
  name: 'search_uploads',
  description: 'Search contents across all uploaded files.',
  input: zSearchUploadsInput.toJSONSchema(),
  output: zSearchUploadsOutput.toJSONSchema(),
  run: async ({ user, generation, callbacks }, input) => {
    let result: FileSearchResult[] = [];

    if (input.mode === 'semantic') {
      const embedding = await callbacks.embed(input.query);
      result = await searchFiles(
        user,
        uploadIds(generation.context),
        input.query,
        embedding ?? undefined,
      );
    } else if (input.mode === 'regex') {
      const files = (
        await globalThis.prisma.file.findMany({
          where: {
            uploadId: { in: uploadIds(generation.context) },
          },
          include: {
            upload: {
              select: {
                name: true,
              },
            },
          },
        })
      ).filter((f) => shouldEmbedFile(f.path.join('/'), f.data));

      for (const file of files) {
        const text = Buffer.from(file.data).toString('utf-8');
        const lines = text.split('\n');
        lines.forEach((line) => {
          const query = new RegExp(input.query, 'i');
          if (query.test(line)) {
            result.push({
              id: file.id,
              uploadId: file.uploadId!,
              uploadName: file.upload!.name,
              path: file.path,
              data: file.data,
            });
          }
        });
      }
    }

    return result.map((r) => ({
      path: r.path,
      snippet: snippetText(Buffer.from(r.data).toString('utf-8'), input.query, 2500),
      uploadName: r.uploadName,
    }));
  },
};

export const uploads: ToolGroup = {
  name: 'upload',
  tools: [ReadUpload, SearchUploads],
  instructions: {
    heading: 'Uploads',
    body: `You have access to files uploaded by the user via the read_upload and search_uploads tools.`,
  },
};

export function uploadIds(context: zContextItem[]) {
  return context.flatMap((m) =>
    m.data
      .flat()
      .filter((d) => d.type === 'upload')
      .map((u) => u.id),
  );
}
