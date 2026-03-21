import { z } from 'zod';
import type { Action } from '../generated/prisma/client.ts';
import { type Message } from '../generated/prisma/client.ts';
import { Author } from '../generated/prisma/enums.ts';

export type ModelFeature = 'generate' | 'embed';

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
    mime: z.string().optional(),
    url: z.string(),
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
    url: z.string(),
  }),
  z.object({
    type: z.literal('metadata'),
    value: zMetadata,
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

export function snippetText(text: string, query: string, window = 160): string {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();

  let matchIndex = -1;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index !== -1) {
      matchIndex = index;
      break;
    }
  }

  if (window <= 0) return text;

  if (matchIndex === -1) return text.length > window ? text.slice(0, window) + '…' : text;

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

export function shouldEmbed(mime?: string, extension?: string) {
  if (!mime && !extension) return false;
  const ext = extension?.toLowerCase();
  const mimeInfo = mime?.toLowerCase();
  return (
    [
      'ts',
      'tsx',
      'js',
      'jsx',
      'mjs',
      'cjs',
      'json',
      'yaml',
      'yml',
      'toml',
      'xml',
      'svg',
      'md',
      'mdx',
      'txt',
      'csv',
      'html',
      'css',
      'scss',
      'sass',
      'less',
      'py',
      'rb',
      'go',
      'rs',
      'java',
      'kt',
      'swift',
      'c',
      'cpp',
      'h',
      'sh',
      'bash',
      'zsh',
      'fish',
      'env',
      'gitignore',
      'dockerfile',
    ].includes(ext ?? '') ||
    [
      'application/json',
      'application/xml',
      'text/plain',
      'text/markdown',
      'text/csv',
      'text/html',
      'text/css',
      'text/javascript',
    ].includes(mimeInfo ?? '')
  );
}
