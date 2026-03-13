import { z } from 'zod';
import type { CustomTool, ToolContext } from './index.ts';

export const zAskUser = z.object({
  question: z.string().describe('The question to ask the user.'),
  answers: z
    .array(z.string())
    .describe('A list of acceptable answers. The user must respond with one of these exactly.'),
});

const AskUser = {
  name: 'ask_user',
  description:
    'Ask the user a question and wait for their response. Use this when additional information would improve the quality of the response. Cannot be used in parallel with other tools or in a tool chain.',
  parameters: zAskUser.toJSONSchema(),
  schema: zAskUser,
  needsUserInput: true,
  run: async () => {
    return new Promise<void>((r) => r());
  },
} satisfies CustomTool<typeof zAskUser>;

export default function tools({ session }: ToolContext) {
  if (!session.user.settings.embeddingConfig) return [];
  return [AskUser];
}
