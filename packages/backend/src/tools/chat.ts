/**
 * Virtual file system, wrapped when a real filesystem is enabled on desktop.
 */
import type { FileSearchResult } from '@tiny-chat/shared/src/types/chat.ts';
import { shouldIncludeFile } from '../utils.ts';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { searchFiles } from '../routes/input.ts';
import { snippetText } from '@tiny-chat/shared/src/utils.ts';
import type { zShellExecInput, zShellExecOutput } from '@tiny-chat/shared/src/tools/system.ts';
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
  zShellExec,
  zWriteFile,
  type zWriteFileInput,
  type zWriteFileOutput,
} from '@tiny-chat/shared/src/tools/system.ts';
import {
  fromChatUriOrThrow,
  mimeType,
  pathStartsWith,
  toChatUri,
} from '@tiny-chat/shared/src/utils/files.ts';
import { Bash, InMemoryFs, MountableFs } from 'just-bash';
import { DBFS } from '../services/dbfs.ts';

export const ReadFile: Tool<typeof zReadFileInput, typeof zReadFileOutput> = {
  ...zReadFile,
  run: async (context, input) => {
    const fs = new DBFS(context);
    await fs.init();
    const data = await fs.readFileBuffer(input.path);
    return [
      {
        type: 'file',
        mime: await mimeType(data, input.path.split('/').slice(-1)[0], 'text/plain'),
        name: input.path.split('/').slice(-1)[0],
        data: Buffer.from(data).toString('base64'),
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
  run: async (context, input) => {
    const fs = new DBFS(context);
    await fs.init();
    await fs.writeFile(input.path, Buffer.from(input.content));
    return [{ type: 'json', value: { path: input.path } }];
  },
};

export const ListFiles: Tool<typeof zListFilesInput, typeof zListFilesOutput> = {
  ...zListFiles,
  run: async (context, input) => {
    const fs = new DBFS(context);
    await fs.init();
    return [
      {
        type: 'json',
        value: {
          path: input.path,
          files: await fs.readdir(input.path),
        },
      },
    ];
  },
};

export const SearchFiles: Tool<typeof zSearchFilesInput, typeof zSearchFilesOutput> = {
  ...zSearchFiles,
  run: async ({ user, chat, callbacks }, input) => {
    const uri = fromChatUriOrThrow(input.path);

    let result: FileSearchResult[] = [];

    // TODO - match upload files in chat, fall back to original uploads
    if (input.mode === 'semantic') {
      const embedding = await callbacks.embed(input.query);
      result = await searchFiles(
        user,
        input.query,
        embedding ?? undefined,
        undefined,
        uri.uploadId ? undefined : chat!.id,
        uri.uploadId ? [uri.uploadId] : undefined,
        uri.path,
      );
    } else if (input.mode === 'regex') {
      const files = (
        await globalThis.prisma.file.findMany({
          where: {
            userId: user.id,
            ...(uri.uploadId ? { uploadId: uri.uploadId } : { chatId: chat!.id }),
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

const shells = new Map<string, { bash: Bash; dbfs: DBFS }>();

export const ShellExec: Tool<typeof zShellExecInput, typeof zShellExecOutput> = {
  ...zShellExec,
  requirements: {
    chat: true,
    approval: true,
  },
  run: async (context, input) => {
    if (!input.chat) throw new Error('Non-chat shell not available in this context');

    if (!shells.has(context.chat!.id)) {
      console.log(`Creating virtual Bash shell for chat: ${context.chat!.id}`);
      const dbfs = new DBFS(context, '/');
      const fs = new MountableFs({
        base: new InMemoryFs(),
        mounts: [
          {
            mountPoint: '/mnt/chat/',
            filesystem: dbfs,
          },
        ],
      });
      const bash = new Bash({
        fs,
        defenseInDepth: { enabled: true, auditMode: true },
        python: true,
        cwd: '/mnt/chat/',
      });
      shells.set(context.chat!.id, { bash, dbfs });
    }

    const { bash, dbfs } = shells.get(context.chat!.id)!;
    await dbfs.init();
    const { exitCode, stdout, stderr } = await bash.exec(input.command);
    return [
      {
        type: 'json',
        value: {
          status: exitCode,
          stdout,
          stderr,
        },
      },
    ];
  },
};

export const chat: ToolGroup = {
  name: 'chat',
  tools: [ReadFile, WriteFile, ListFiles, SearchFiles, ShellExec],
  instructions: {
    heading: 'This Chat',
    body: 'You have access to a user-facing virtual chat filesystem at `/mnt/chat/`, as well as a virtual python3-equipped chat shell (by calling `shell_exec` with chat=true).',
  },
};
