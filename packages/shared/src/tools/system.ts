/**
 * Shared types for the frontend (system) and backend (uploads, skills) filesystems.
 */

import { z } from 'zod';
import type { zTool } from '../types/tool.ts';

export const zReadFileInput = z.object({
  path: z.string().describe('The absolute path of the file to read.'),
});
export type zReadFileInput = z.infer<typeof zReadFileInput>;

export const zReadFileOutput = z.never();
export type zReadFileOutput = z.infer<typeof zReadFileOutput>;

export const zReadFile: zTool = {
  name: 'read_file',
  description: 'Read the contents of a file.',
  input: zReadFileInput.toJSONSchema(),
  output: zReadFileOutput.toJSONSchema(),
};

export const zWriteFileInput = z.object({
  path: z.string().describe('The absolute path of the file to write to.'),
  content: z.string().describe('The new content of the file.'),
});
export type zWriteFileInput = z.infer<typeof zWriteFileInput>;

export const zWriteFileOutput = z.object({ path: z.string() });
export type zWriteFileOutput = z.infer<typeof zWriteFileOutput>;

export const zWriteFile: zTool = {
  name: 'write_file',
  description: 'Overwrite the contents of a file.',
  input: zWriteFileInput.toJSONSchema(),
  output: zWriteFileOutput.toJSONSchema(),
  requirements: {
    approval: true,
  },
};

export const zListFilesInput = z.object({
  path: z.string().describe('The absolute path of the directory to list files in.'),
});
export type zListFilesInput = z.infer<typeof zListFilesInput>;

export const zListFilesOutput = z.object({
  path: z.string().describe('The absolute path of the directory.'),
  files: z.array(z.string()).describe('The list of files in the directory.'),
});
export type zListFilesOutput = z.infer<typeof zListFilesOutput>;

export const zListFiles: zTool = {
  name: 'list_files',
  description: 'List the files in a directory.',
  input: zListFilesInput.toJSONSchema(),
  output: zListFilesOutput.toJSONSchema(),
};

export const zSearchFilesInput = z.object({
  path: z.string().describe('The absolute path of the directory to search in.'),
  query: z.string().describe('The query to search for (do not include slashes or flags in regex).'),
  mode: z.enum(['semantic', 'regex']),
});
export type zSearchFilesInput = z.infer<typeof zSearchFilesInput>;

export const zSearchFilesOutput = z.array(
  z.object({
    path: z.string(),
    snippet: z.string(),
  }),
);
export type zSearchFilesOutput = z.infer<typeof zSearchFilesOutput>;

export const zSearchFiles: zTool = {
  name: 'search_files',
  description: 'Search for files semantically or via case-insensitive regex.',
  input: zSearchFilesInput.toJSONSchema(),
  output: zSearchFilesOutput.toJSONSchema(),
};

export const zShellExecInput = z.object({
  command: z.string(),
  chat: z
    .boolean()
    .describe(
      "True to use the chat shell (/mnt/chat), false to use the user's local shell (if available).",
    ),
});
export type zShellExecInput = z.infer<typeof zShellExecInput>;

export const zShellExecOutput = z.object({
  status: z.number().optional(),
  stderr: z.string(),
  stdout: z.string(),
});
export type zShellExecOutput = z.infer<typeof zShellExecOutput>;

export const zShellExec: zTool = {
  name: 'shell_exec',
  description: 'Execute a shell command.',
  input: zShellExecInput.toJSONSchema(),
  output: zShellExecOutput.toJSONSchema(),
  requirements: {
    approval: true,
  },
};
