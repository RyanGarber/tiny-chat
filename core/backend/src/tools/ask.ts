import { z } from 'zod';
import type { ToolCall, ToolContext } from './index.ts';

export const zAskQuestion = z.object({
  question: z.string(),
  suggestions: z.array(z.string()).optional().describe('A list autocomplete suggestions.'),
});

const AskQuestion = {
  name: 'ask_question',
  description: 'Ask the user a question mid-response.',
  parameters: zAskQuestion.toJSONSchema(),
  schema: zAskQuestion,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zAskQuestion>;

export const zAskColor = z.object({
  question: z.string(),
});

const AskColor = {
  name: 'ask_color',
  description: 'Ask the user for a color mid-response.',
  parameters: zAskColor.toJSONSchema(),
  schema: zAskColor,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zAskColor>;

export const zAskNumber = z.object({
  question: z.string(),
});

const AskNumber = {
  name: 'ask_number',
  description: 'Ask the user for a number mid-response.',
  parameters: zAskNumber.toJSONSchema(),
  schema: zAskNumber,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zAskNumber>;

export const zAskDatetime = z.object({
  question: z.string(),
  date: z.boolean().describe('Request a date.'),
  time: z.boolean().describe('Request a time.'),
});

const AskDatetime = {
  name: 'ask_datetime',
  description: 'Ask the user a date/time mid-response.',
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
