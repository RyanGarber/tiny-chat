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
  zShellExecInput,
  zShellExecOutput,
  zWriteFileInput,
  zWriteFileOutput,
} from '@tiny-chat/shared/src/tools/system.ts';
import {
  zListFiles,
  zReadFile,
  zSearchFiles,
  zShellExec,
  zWriteFile,
} from '@tiny-chat/shared/src/tools/system.ts';
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
      console.log('/mnt/chat file detected, forwarding to backend');
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
      console.log('/mnt/chat file detected, forwarding to backend');
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
      console.log('/mnt/chat file detected, forwarding to backend');
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
      console.log('/mnt/chat file detected, forwarding to backend');
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
        type: 'text',
        value: `Search results${input.mode === 'semantic' ? ' (note: fell back to regex search)' : ''}:`,
      },
      {
        type: 'json',
        value: files
          .filter((file) => isTextAdjacent(file.mime))
          .map((file) => ({
            path: file.path,
            snippet: snippetText(decodeTextLossy(file.content, file.mime), input.query, 1000),
          })),
      },
    ];
  },
};

const ShellExec: Tool<typeof zShellExecInput, typeof zShellExecOutput> = {
  ...zShellExec,
  requirements: {
    desktop: true,
    approval: true,
  },
  overrides: true,
  run: async (context, input, userInput) => {
    if (input.chat) {
      console.log('Chat environment requested, forwarding to backend');
      return await trpc.input.callTool.mutate({
        name: ShellExec.name,
        context,
        input,
        userInput,
      });
    }
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

export const pc: ToolGroup = {
  name: 'pc',
  tools: [ReadFile, WriteFile, ListFiles, SearchFiles, ShellExec],
  instructions: {
    heading: 'This PC',
    body: "You have access to the user's local filesystem, as well as the user's local shell (by calling `shell_exec` with chat=false).",
  },
};
