import { z } from 'zod';
import { invoke } from '@/utils/api.ts';
import { Tool, type ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';

export const zReadDirInput = z.object({
  path: z.string().describe('The absolute path of the directory to read.'),
});

export const zReadDirOutput = z.object({
  path: z.string(),
  contents: z.any(), // TODO - other types?
});

export const ReadDir: Tool<typeof zReadDirInput, typeof zReadDirOutput> = {
  name: 'read_dir',
  description: 'Read the contents of a directory.',
  input: zReadDirInput.toJSONSchema(),
  output: zReadDirOutput.toJSONSchema(),
  requirements: {
    desktop: true,
  },
  run: async (_, input) => {
    return { path: input.path, contents: await invoke('read_dir', { path: input.path }) };
  },
};

export const zReadFileInput = z.object({
  path: z.string().describe('The absolute path of the file to read.'),
});

export const zReadFileOutput = z.object({ path: z.string(), contents: z.string() });

export const ReadFile: Tool<typeof zReadFileInput, typeof zReadFileOutput> = {
  name: 'read_file',
  description: 'Read the contents of a file.',
  input: zReadFileInput.toJSONSchema(),
  output: zReadFileOutput.toJSONSchema(),
  requirements: {
    desktop: true,
  },
  run: async (_, input) => {
    return { path: input.path, contents: await invoke('read_file', { path: input.path }) };
  },
};

export const zWriteFileInput = z.object({
  path: z.string().describe('The absolute path of the file to write.'),
  contents: z.string().describe('The contents of the file to write.'),
});

export const zWriteFileOutput = z.object({
  path: z.string().describe('The absolute path of the file that was written.'),
});

export const WriteFile: Tool<typeof zWriteFileInput, typeof zWriteFileOutput> = {
  name: 'write_file',
  description: 'Write to a file.',
  input: zWriteFileInput.toJSONSchema(),
  output: zWriteFileOutput.toJSONSchema(),
  requirements: {
    desktop: true,
    approval: true,
  },
  run: async (_, input) => {
    await invoke('write_file', input);
    return { path: input.path };
  },
};

export const filesystem: ToolGroup = {
  name: 'filesystem',
  tools: [ReadDir, ReadFile, WriteFile],
  instructions: {
    heading: 'Filesystem',
    body: "You have access to the user's filesystem. Use read_dir and read_file to read files and directories.",
  },
};
