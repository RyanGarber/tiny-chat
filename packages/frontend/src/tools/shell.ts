import { z } from 'zod';
import { Tool, type ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { invoke } from '@/utils/api.ts';

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
    return await invoke<{ status?: number; stderr: string; stdout: string }>('shell_exec', {
      command: input.command,
    });
  },
};

export const shell: ToolGroup = {
  name: 'shell',
  tools: [ShellExec],
  instructions: { heading: 'Shell', body: "You have access to the user's shell. " },
};
