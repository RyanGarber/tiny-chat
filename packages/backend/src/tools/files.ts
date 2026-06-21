/**
 * Virtual file system, wrapped when a real filesystem is enabled on desktop.
 */
import type { FileSearchResult } from '@tiny-chat/shared/src/types/chat.ts';
import { shouldIncludeFile } from '../utils.ts';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { searchFiles } from '../routes/input.ts';
import { snippetText, uploadIds } from '@tiny-chat/shared/src/utils.ts';
import {
  zListFiles,
  type zListFilesInput,
  type zListFilesOutput,
  zReadFile,
  type zReadFileInput,
  type zReadFileOutput,
  zSearchFiles,
  type zSearchFilesInput,
  type zSearchFilesOutput,
  zWriteFile,
  type zWriteFileInput,
  type zWriteFileOutput,
} from '@tiny-chat/shared/src/tools/files.ts';
import {
  fromChatUriOrThrow,
  mimeType,
  pathIsChildOf,
  pathStartsWith,
  toChatUri,
} from '@tiny-chat/shared/src/utils/files.ts';
import { createId } from '@paralleldrive/cuid2';

export const ReadFile: Tool<typeof zReadFileInput, typeof zReadFileOutput> = {
  ...zReadFile,
  run: async ({ user }, input) => {
    const uri = fromChatUriOrThrow(input.path);
    const file = await globalThis.prisma.file.findFirstOrThrow({
      where: {
        userId: user.id,
        ...(uri.uploadId ? { uploadId: uri.uploadId } : {}),
        path: { equals: uri.path },
      },
    });
    return [
      {
        type: 'file',
        mime: file.mime,
        name: uri.path?.slice(-1)[0],
        data: Buffer.from(file.data).toString('base64'),
      },
    ];
  },
};

export const WriteFile: Tool<typeof zWriteFileInput, typeof zWriteFileOutput> = {
  ...zWriteFile,
  requirements: {
    ...zWriteFile.requirements,
    chat: true,
  },
  run: async ({ user, chat }, input) => {
    const uri = fromChatUriOrThrow(input.path);

    const data = Buffer.from(input.content);
    const existing = await globalThis.prisma.file.findFirst({
      where: {
        userId: user.id,
        uploadId: uri.uploadId ?? null,
        chatId: chat!.id,
        path: { equals: uri.path ?? [] },
      },
    });

    if (existing) {
      await globalThis.prisma.file.update({
        where: {
          id: existing.id,
        },
        data: {
          data,
          mime: await mimeType(data, uri.path.slice(-1)[0], existing.mime),
          createdAt: new Date(),
        },
      });
    } else {
      await globalThis.prisma.file.create({
        data: {
          id: createId(),
          user: { connect: { id: user.id } },
          chat: { connect: { id: chat!.id } },
          ...(uri.uploadId ? { upload: { connect: { id: uri.uploadId } } } : {}),
          path: uri.path,
          data,
          mime: await mimeType(data, uri.path.slice(-1)[0], 'text/plain'),
        },
      });
    }

    return [{ type: 'json', value: { path: input.path } }];
  },
};

export const ListFiles: Tool<typeof zListFilesInput, typeof zListFilesOutput> = {
  ...zListFiles,
  run: async ({ user, generation }, input) => {
    const uri = fromChatUriOrThrow(input.path);
    const files = await globalThis.prisma.file.findMany({
      where: {
        userId: user.id,
        ...(uri.uploadId
          ? { uploadId: uri.uploadId }
          : { uploadId: { in: uploadIds(generation.context) } }),
      },
      select: {
        uploadId: true,
        path: true,
      },
    });
    console.log(
      '[%]',
      files.map((f) => ({ ...f, path: f.path.join('/') })),
    );
    return [
      {
        type: 'json',
        value: {
          path: input.path,
          files: files
            .filter(
              (f) => pathIsChildOf(f.path, uri.path) && shouldIncludeFile(f.path.join('/'), true),
            )
            .map((f) => toChatUri(f.uploadId, f.path)),
        },
      },
    ];
  },
};

export const SearchFiles: Tool<typeof zSearchFilesInput, typeof zSearchFilesOutput> = {
  ...zSearchFiles,
  run: async ({ user, callbacks, generation }, input) => {
    const uri = fromChatUriOrThrow(input.path);

    let result: FileSearchResult[] = [];

    if (input.mode === 'semantic') {
      const embedding = await callbacks.embed(input.query);
      result = await searchFiles(
        user,
        input.query,
        embedding ?? undefined,
        undefined,
        uploadIds(generation.context),
        uri.path,
      );
    } else if (input.mode === 'regex') {
      const files = (
        await globalThis.prisma.file.findMany({
          where: {
            userId: user.id,
            ...(uri.uploadId
              ? { uploadId: uri.uploadId }
              : { uploadId: { in: uploadIds(generation.context) } }),
          },
        })
      ).filter(
        (f) => pathStartsWith(f.path, uri.path) && shouldIncludeFile(f.path.join('/'), true),
      );

      for (const file of files) {
        try {
          const decoder = new TextDecoder('utf8', { fatal: true });
          const text = decoder.decode(file.data);
          const lines = text.split('\n');
          lines.forEach((line) => {
            const query = new RegExp(input.query, 'i');
            console.log(line, input.query, query.source, query.test(line));
            if (query.test(line)) result.push(file);
          });
        } catch (e) {
          console.warn(`Skipping search of file ${file.path.slice(-1)[0]} due to error`, e);
        }
      }
    }

    return [
      {
        type: 'json',
        value: result.map((r) => ({
          path: toChatUri(r.uploadId, r.path),
          snippet: snippetText(Buffer.from(r.data).toString('utf-8'), input.query, 1000),
        })),
      },
    ];
  },
};

export const files: ToolGroup = {
  name: 'files',
  tools: [ReadFile, WriteFile, ListFiles, SearchFiles],
  instructions: {
    heading: 'Files',
    body: `You have access to a user-facing virtual filesystem at \`chat:///\` which you can read and write to. IMPORTANT: shell commands will not work in chat:///.`,
  },
};
