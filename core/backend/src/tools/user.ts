import { z } from 'zod';
import type { ToolCall, ToolContext } from './index.ts';

export const zAskUser = z.object({
  question: z.string().describe('The question to ask the user.'),
  answers: z
    .array(z.string())
    .describe('A list of acceptable answers. The user must respond with one of these exactly.'),
});

const AskUser = {
  name: 'ask_user',
  description:
    'Ask the user a question and wait for their response. Use this any time additional information would improve the quality of the response.',
  parameters: zAskUser.toJSONSchema(),
  schema: zAskUser,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zAskUser>;

export default function tools({ user, generateInput }: ToolContext) {
  if (!user.settings.embeddingConfig) return [];
  return generateInput.userInput ? [AskUser] : [];
}
