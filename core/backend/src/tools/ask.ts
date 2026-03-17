import { z } from 'zod';
import type { ToolCall, ToolContext } from './index.ts';

export const zAskQuestion = z.object({
  question: z.string().describe('The question to ask the user.'),
  suggestions: z
    .array(z.string())
    .describe(
      'A list of suggested answers. The user may choose one from the list or provide their own.',
    ),
});

const AskQuestion = {
  name: 'ask_question',
  description:
    'Ask the user a question and get their response. Use this any time additional information would be useful in the response.',
  parameters: zAskQuestion.toJSONSchema(),
  schema: zAskQuestion,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zAskQuestion>;

export const zAskColor = z.object({
  question: z.string().describe('The question to ask the user.'),
});

const AskColor = {
  name: 'ask_color',
  description:
    'Ask the user for a color and get their response. Use this any time additional information would be useful in the response.',
  parameters: zAskColor.toJSONSchema(),
  schema: zAskColor,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zAskColor>;

export const zAskNumber = z.object({
  question: z.string().describe('The question to ask the user.'),
});

const AskNumber = {
  name: 'ask_number',
  description:
    'Ask the user for a number and get their response. Use this any time additional information would be useful in the response.',
  parameters: zAskNumber.toJSONSchema(),
  schema: zAskNumber,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zAskNumber>;

export const zAskDatetime = z.object({
  question: z.string().describe('The question to ask the user.'),
  date: z.boolean().describe('Whether the user is being asked for a date.'),
  time: z.boolean().describe('Whether the user is being asked for a time.'),
});

const AskDatetime = {
  name: 'ask_datetime',
  description:
    'Ask the user for a date and/or time and get their response. Use this any time additional information would be useful in the response.',
  parameters: zAskDatetime.toJSONSchema(),
  schema: zAskDatetime,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zAskDatetime>;

export default function tools({ user, generateInput }: ToolContext) {
  if (!user.settings.embeddingConfig) return [];
  return generateInput.userInput ? [AskQuestion, AskColor, AskNumber, AskDatetime] : [];
}
