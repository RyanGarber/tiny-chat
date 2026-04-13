import { z } from 'zod';
import type { Action } from '../generated/prisma/client.ts';
import { type Message } from '../generated/prisma/client.ts';
import { Author } from '../generated/prisma/enums.ts';

export type ModelFeature = 'generate' | 'embed' | 'toolCall';

export type ModelArg =
  | {
      type: 'list';
      name: string;
      values: string[];
      default: string;
    }
  | {
      type: 'range';
      name: string;
      min: number;
      max: number;
      step: number;
      default: number;
    };

export interface Model {
  name: string;
  features: ModelFeature[];
  args: ModelArg[];
}

export interface ChatProviderStatus {
  name: string;
  settings: string[];
  models: Model[];
  error?: string;
}

export interface SearchProviderStatus {
  name: string;
  settings: string[];
  available: boolean;
  error?: string;
}

export const zConfig = z.object({
  provider: z.string(),
  model: z.string(),
  args: z.any().optional(),
  schema: z.any().optional(),
});

export type zConfig = z.infer<typeof zConfig>;

export const zDataPart = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('thought'),
    id: z.string().optional(),
    continued: z.boolean().optional(),
    value: z.string(),
  }),
  z.object({
    type: z.literal('text'),
    value: z.string(),
    hidden: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('outputFile'),
    name: z.string().optional(),
    mime: z.string(),
    data: z.base64(),
  }),
  z.object({
    type: z.literal('upload'),
    id: z.cuid2(),
    name: z.string(),
    thumbnail: z.string().optional(),
  }),
  z.object({
    type: z.literal('inputFile'),
    name: z.string().optional(),
    mime: z.string(),
    data: z.base64(),
  }),
  z.object({
    type: z.literal('toolCall'),
    id: z.string(),
    name: z.string(),
    args: z.any(),
  }),
  z.object({
    type: z.literal('toolResult'),
    id: z.string(),
    name: z.string(),
    value: z.any(),
    error: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('abort'),
    reason: z.enum(['user', 'content', 'length', 'error', 'other']),
    message: z.string().optional(),
    details: z.any().optional(),
  }),
  z.object({
    type: z.literal('other'),
    value: z.any(),
  }),
]);

export type zDataPart = z.infer<typeof zDataPart>;

export const zData = z.array(zDataPart);

export type zData = z.infer<typeof zData>;

export const zMetadata = z.array(z.any());

export type zMetadata = z.infer<typeof zMetadata>;

// ── Stream / special part types ───────────────────────────────────

export const zSpecialPart = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fileUpdate'),
    name: z.string(),
    data: z.base64(),
  }),
  z.object({
    type: z.literal('metadata'),
    value: zMetadata,
  }),
  z.object({
    type: z.literal('replyId'),
    value: z.string(),
  }),
]);

export type zSpecialPart = z.infer<typeof zSpecialPart>;

export const zGenerateInput = z.object({
  context: z.array(z.object({ id: z.cuid2().nullable(), author: z.enum(Author), data: zData })),
  config: zConfig,
  timezone: z.string(),
  userInput: z.boolean(),
  overrideInstructions: z.string().optional(),
});
export type zGenerateInput = z.infer<typeof zGenerateInput>;

export const zGenerateMessageInput = z.object({
  messageId: z.cuid2(),
  timezone: z.string(),
  userInput: z.boolean(),
  overrideInstructions: z.string().optional(),
});
export type zGenerateMessageInput = z.infer<typeof zGenerateMessageInput>;

export const zContinueToolCallInput = z.object({
  messageId: z.cuid2(),
  toolCallId: z.string(),
  toolName: z.string(),
  value: z.any(),
  timezone: z.string(),
});
export type zContinueToolCallInput = z.infer<typeof zContinueToolCallInput>;

export const zGenerateOutput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('data'), value: zDataPart }),
  z.object({ type: z.literal('special'), value: zSpecialPart }),
]);
export type zGenerateOutput = z.infer<typeof zGenerateOutput>;

export type MessageUnomitted = Message & {
  config: zConfig;
  data: zData;
  metadata: zMetadata;
  state: {
    any: boolean;
    thinking: boolean;
    generating: boolean;
  };
};

export interface MessageOmission {
  metadata: zMetadata;
}

export type MessageOmitted = Omit<MessageUnomitted, 'metadata'>;

export type ContextItem = MessageUnomitted | { id: null; author: Author; data: zData };

export function wrapMessage(message: Message): MessageOmitted {
  return {
    ...message,
    config: zConfig.parse(message.config),
    data: zData.parse(message.data),
    state: {
      any: false,
      thinking: false,
      generating: false,
    },
  };
}

export function wrapMessageUnomitted(message: Message): MessageUnomitted {
  return {
    ...message,
    config: zConfig.parse(message.config),
    data: zData.parse(message.data),
    metadata: zMetadata.parse(message.metadata),
    state: {
      any: false,
      thinking: false,
      generating: false,
    },
  };
}

export function texts(data: zData) {
  return data
    .filter((p) => p.type === 'text')
    .map((p) => p.value)
    .join(' ');
}

export function normalizeText(text: string) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length && !/^\[(user|assistant)/.exec(lines[i].trim())) {
      return text;
    }
    if (/^\[(user|assistant)/.exec(lines[i].trim())) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().length && !/^\[(user|assistant)/.exec(lines[j].trim())) {
          return lines.slice(j).join('\n');
        }
      }
    }
  }
  return text;
}

export function snippetText(text: string, query: string | RegExp, window = 160): string {
  const lower = text.toLowerCase();

  if (query instanceof RegExp) {
    const match = query.exec(text) ?? query.exec(lower);
    if (!match) return text.length > window ? text.slice(0, window) + '…' : text;
    return extractSnippet(text, match.index, window);
  }

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return text.length > window ? text.slice(0, window) + '…' : text;

  // Collect all match positions for all terms
  const hits: number[] = [];
  for (const term of terms) {
    let from = 0;
    while (true) {
      const i = lower.indexOf(term, from);
      if (i === -1) break;
      hits.push(i);
      from = i + 1;
    }
  }

  if (!hits.length) return text.length > window ? text.slice(0, window) + '…' : text;

  // Find the window start position that covers the most hits
  hits.sort((a, b) => a - b);
  let bestStart = hits[0];
  let bestCount = 0;
  for (let i = 0; i < hits.length; i++) {
    const windowEnd = hits[i] + window;
    let count = 0;
    for (let j = i; j < hits.length && hits[j] < windowEnd; j++) count++;
    if (count > bestCount) {
      bestCount = count;
      bestStart = hits[i];
    }
  }

  return extractSnippet(text, bestStart, window);
}

function extractSnippet(text: string, matchIndex: number, window: number): string {
  if (window <= 0) return text;

  const half = Math.floor(window / 2);
  let start = Math.max(0, matchIndex - half);
  let end = Math.min(text.length, matchIndex + half);

  if (start > 0) {
    const i = text.indexOf(' ', start);
    if (i !== -1 && i < matchIndex) start = i + 1;
  }
  if (end < text.length) {
    const i = text.lastIndexOf(' ', end);
    if (i !== -1 && i > matchIndex) end = i;
  }

  const snippet = text.slice(start, end).trim();
  return (start > 0 ? '…' : '') + snippet + (end < text.length ? '…' : '');
}

export async function getNextRunAt(action: Action) {
  const RRule = (await import('rrule')).default?.RRule ?? (await import('rrule')).RRule;
  const schedule = RRule.fromString(action.schedule);
  const startAt = schedule.options.dtstart;
  const searchFrom = action.lastRanAt ?? new Date(startAt.getTime() - 1);
  return schedule.after(searchFrom, false);
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const zUploadOutput = z.array(z.custom<Extract<zDataPart, { type: 'upload' }>>());

export type zUploadOutput = z.infer<typeof zUploadOutput>;
