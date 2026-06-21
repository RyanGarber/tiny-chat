import { z } from 'zod';
import { invoke, trpc } from '@/utils/api.ts';
import type { Tool } from '@tiny-chat/shared/src/types/tool.ts';
import { type ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import type {
  zListFilesInput,
  zListFilesOutput,
  zReadFileInput,
  zReadFileOutput,
  zSearchFilesInput,
  zSearchFilesOutput,
  zWriteFileInput,
  zWriteFileOutput,
} from '@tiny-chat/shared/src/tools/files.ts';
import {
  zListFiles,
  zReadFile,
  zSearchFiles,
  zWriteFile,
} from '@tiny-chat/shared/src/tools/files.ts';
import {
  decodeTextLossy,
  fromChatUri,
  isTextAdjacent,
  mimeType,
} from '@tiny-chat/shared/src/utils/files.ts';
import { snippetText } from '@tiny-chat/shared/src/utils.ts';

const ReadFile: Tool<typeof zReadFileInput, typeof zReadFileOutput> = {
  ...zReadFile,
  requirements: {
    desktop: true,
  },
  overrides: true,
  run: async (context, input, userInput) => {
    if (fromChatUri(input.path)) {
      console.log('chat:// file detected, forwarding to backend');
      return (await trpc.input.callTool.mutate({
        name: ReadFile.name,
        context,
        input,
        userInput,
      })) as never;
    }
    const name = input.path.split('/').pop();
    const content = await invoke<string>('read_file', { path: input.path });

    return [
      {
        type: 'file',
        name,
        mime: (await mimeType(content, input.path)) ?? 'application/octet-stream',
        data: content,
      },
    ];
  },
};

const WriteFile: Tool<typeof zWriteFileInput, typeof zWriteFileOutput> = {
  ...zWriteFile,
  requirements: {
    desktop: true,
    approval: true,
  },
  overrides: true,
  run: async (context, input, userInput) => {
    if (fromChatUri(input.path)) {
      console.log('chat:// file detected, forwarding to backend');
      return await trpc.input.callTool.mutate({
        name: WriteFile.name,
        context,
        input,
        userInput,
      });
    }
    const bytes = new TextEncoder().encode(input.content);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    await invoke('write_file', { path: input.path, content: btoa(binary) });
    return [{ type: 'json', value: { path: input.path } }];
  },
};

const ListFiles: Tool<typeof zListFilesInput, typeof zListFilesOutput> = {
  ...zListFiles,
  requirements: {
    desktop: true,
  },
  overrides: true,
  run: async (context, input, userInput) => {
    if (fromChatUri(input.path)) {
      console.log('chat:// file detected, forwarding to backend');
      return await trpc.input.callTool.mutate({
        name: ListFiles.name,
        context,
        input,
        userInput,
      });
    }
    return [
      {
        type: 'json',
        value: { path: input.path, files: await invoke('list_files', { path: input.path }) },
      },
    ];
  },
};

const SearchFiles: Tool<typeof zSearchFilesInput, typeof zSearchFilesOutput> = {
  ...zSearchFiles,
  requirements: {
    desktop: true,
  },
  overrides: true,
  run: async (context, input, userInput) => {
    if (fromChatUri(input.path)) {
      console.log('chat:// file detected, forwarding to backend');
      return await trpc.input.callTool.mutate({
        name: SearchFiles.name,
        context,
        input,
        userInput,
      });
    }
    const files = await Promise.all(
      (
        await invoke<{ path: string; content: string }[]>('search_files', {
          path: input.path,
          query: input.query,
        })
      ).map(async (file) => ({
        ...file,
        mime: (await mimeType(file.content, file.path)) ?? 'application/octet-stream',
      })),
    );
    return [
      {
        type: 'json',
        value: files
          .filter((file) => isTextAdjacent(file.mime))
          .map((file) => ({
            path: file.path,
            snippet: snippetText(decodeTextLossy(file.content, file.mime), input.query, 1000),
          })),
      },
      {
        type: 'text',
        value: '[note] regex search fallback used for local files',
      },
    ];
  },
};

export const zShellExecInput = z.object({
  command: z.string(),
});
export type zShellExecInput = z.infer<typeof zShellExecInput>;

export const zShellExecOutput = z.object({
  status: z.number().optional(),
  stderr: z.string(),
  stdout: z.string(),
});
export type zShellExecOutput = z.infer<typeof zShellExecOutput>;

const ShellExec: Tool<typeof zShellExecInput, typeof zShellExecOutput> = {
  name: 'shell_exec',
  description: 'Execute a shell command.',
  input: zShellExecInput.toJSONSchema(),
  output: zShellExecOutput.toJSONSchema(),
  requirements: {
    desktop: true,
    approval: true,
  },
  run: async (_, input) => {
    return [
      {
        type: 'json',
        value: await invoke<{ status?: number; stderr: string; stdout: string }>('shell_exec', {
          command: input.command,
        }),
      },
    ];
  },
};

export const system: ToolGroup = {
  name: 'system',
  tools: [ReadFile, WriteFile, ListFiles, SearchFiles, ShellExec],
  instructions: {
    heading: 'This PC',
    body: "You have access to the user's filesystem and shell. Use list_files and read_file to the user's local files and directories, and shell_exec to run a command in their local shell.",
  },
};
