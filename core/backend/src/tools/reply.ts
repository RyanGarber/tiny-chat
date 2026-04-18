import { z } from 'zod';
import type { ToolCall, ToolContext } from './index.ts';

export const zReplyQuestion = z.object({
  question: z.string(),
  suggestions: z.array(z.string()).default([]).describe('A list of autocomplete suggestions.'),
});

const ReplyQuestion = {
  name: 'reply_question',
  description: 'Ask the user a question mid-response.',
  parameters: zReplyQuestion.toJSONSchema(),
  schema: zReplyQuestion,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zReplyQuestion>;

export const zReplyColor = z.object({
  question: z.string(),
});

const ReplyColor = {
  name: 'reply_color',
  description: 'Ask the user for a color mid-response.',
  parameters: zReplyColor.toJSONSchema(),
  schema: zReplyColor,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zReplyColor>;

export const zReplyNumber = z.object({
  question: z.string(),
});

const ReplyNumber = {
  name: 'reply_number',
  description: 'Ask the user to reply with a number.',
  parameters: zReplyNumber.toJSONSchema(),
  schema: zReplyNumber,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zReplyNumber>;

export const zReplyDatetime = z.object({
  question: z.string(),
  date: z.boolean().describe('Request a date.'),
  time: z.boolean().describe('Request a time.'),
});

const ReplyDatetime = {
  name: 'reply_datetime',
  description: 'Ask the user to reply with a date and/or time.',
  parameters: zReplyDatetime.toJSONSchema(),
  schema: zReplyDatetime,
  needsUserInput: true,
  run: async ({ generateInput }) => {
    if (!generateInput.userInput) throw new Error('Cannot use tool in this context');
    return new Promise<void>((r) => r());
  },
} satisfies ToolCall<typeof zReplyDatetime>;

export default function tools({ user, generateInput }: ToolContext) {
  if (!user.settings.embeddingConfig) return [];
  return generateInput.userInput ? [ReplyQuestion, ReplyColor, ReplyNumber, ReplyDatetime] : [];
}
