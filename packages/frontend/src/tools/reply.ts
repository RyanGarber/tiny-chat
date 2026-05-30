import { z } from 'zod';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';

export const zReplyQuestionInput = z.object({
  question: z.string(),
  suggestions: z.array(z.string()).default([]).describe('A list of autocomplete suggestions.'),
});
export type zReplyQuestionInput = z.infer<typeof zReplyQuestionInput>;

export const zReplyQuestionOutput = z.object({
  answer: z.string(),
});
export type zReplyQuestionOutput = z.infer<typeof zReplyQuestionOutput>;

const ReplyQuestion: Tool<
  typeof zReplyQuestionInput,
  typeof zReplyQuestionOutput,
  typeof zReplyQuestionOutput
> = {
  name: 'reply_question',
  description: 'Ask the user a question mid-response.',
  input: zReplyQuestionInput.toJSONSchema(),
  userInput: zReplyQuestionOutput.toJSONSchema(),
  output: zReplyQuestionOutput.toJSONSchema(),
  run: async (_context, _input, userInput) => {
    return new Promise((r) => r(userInput));
  },
};

export const zReplyColorInput = z.object({
  question: z.string(),
});
export type zReplyColorInput = z.infer<typeof zReplyColorInput>;

export const zReplyColorOutput = z.object({
  color: z.string(),
});
export type zReplyColorOutput = z.infer<typeof zReplyColorOutput>;

const ReplyColor: Tool<
  typeof zReplyColorInput,
  typeof zReplyColorOutput,
  typeof zReplyColorOutput
> = {
  name: 'reply_color',
  description: 'Ask the user for a color mid-response.',
  input: zReplyColorInput.toJSONSchema(),
  userInput: zReplyColorOutput.toJSONSchema(),
  output: zReplyColorOutput.toJSONSchema(),
  run: async (_context, _input, userInput) => {
    return new Promise((r) => r(userInput));
  },
};

export const zReplyNumberInput = z.object({
  question: z.string(),
});
export type zReplyNumberInput = z.infer<typeof zReplyNumberInput>;

export const zReplyNumberOutput = z.object({
  number: z.number(),
});
export type zReplyNumberOutput = z.infer<typeof zReplyNumberOutput>;

const ReplyNumber: Tool<
  typeof zReplyNumberInput,
  typeof zReplyNumberOutput,
  typeof zReplyNumberOutput
> = {
  name: 'reply_number',
  description: 'Ask the user to reply with a number.',
  input: zReplyNumberInput.toJSONSchema(),
  userInput: zReplyNumberInput.toJSONSchema(),
  output: zReplyNumberOutput.toJSONSchema(),
  run: async (_context, _input, userInput) => {
    return new Promise((r) => r(userInput));
  },
};

export const zReplyDatetimeInput = z.object({
  question: z.string(),
  date: z.boolean().describe('Request a date.'),
  time: z.boolean().describe('Request a time.'),
});
export type zReplyDatetimeInput = z.infer<typeof zReplyDatetimeInput>;

export const zReplyDatetimeOutput = z.object({
  date: z.string().optional(),
  time: z.string().optional(),
});
export type zReplyDatetimeOutput = z.infer<typeof zReplyDatetimeOutput>;

const ReplyDatetime: Tool<
  typeof zReplyDatetimeInput,
  typeof zReplyDatetimeOutput,
  typeof zReplyDatetimeOutput
> = {
  name: 'reply_datetime',
  description: 'Ask the user to reply with a date and/or time.',
  input: zReplyDatetimeInput.toJSONSchema(),
  userInput: zReplyDatetimeInput.toJSONSchema(),
  output: zReplyDatetimeOutput.toJSONSchema(),
  run: async (_context, _input, userInput) => {
    return new Promise((r) => r(userInput));
  },
};

export const reply: ToolGroup = {
  name: 'reply',
  tools: [ReplyQuestion, ReplyColor, ReplyNumber, ReplyDatetime],
  instructions: {
    heading: 'Replies',
    body: 'If more information from the user could improve the response, you can ask them using reply tools.',
  },
};
