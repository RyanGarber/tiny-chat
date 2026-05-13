import type { Action, Message } from '../../backend/generated/prisma/client.ts';
import type { MessageState, ModelArg, zChat, zDataPart } from './types/chat.ts';
import { zConfig, zData, zMetadata } from './types/chat.ts';
import type { zSkill } from './types/skill.ts';
import type { zTool, zToolContext, zToolGroup } from './types/tool.ts';
import type { zCache, zUser } from './types/user.ts';

export function wrapMessage(message: Message): MessageState {
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

export function texts(data: zData, join = ' ') {
  return data
    .flat()
    .filter((p) => p.type === 'text')
    .map((p) => p.value)
    .join(join);
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
      return '';
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

export const RRule = (await import('rrule')).default?.RRule ?? (await import('rrule')).RRule;

const _fm = await import('front-matter');
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - broken default
export const fm = _fm.default?.default ?? _fm.default;

export function getNextRunAt(action: Action | { schedule: string; lastRanAt?: Date | null }) {
  const schedule = RRule.fromString(action.schedule);
  const startAt = schedule.options.dtstart;
  const searchFrom = action.lastRanAt ?? new Date(startAt.getTime() - 1);
  return schedule.after(searchFrom, false);
}

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function getBaseModelArgs(maxTemperature = 2): ModelArg[] {
  return [
    {
      type: 'range',
      name: 'max-tokens',
      min: 2500,
      max: 50000,
      step: 2500,
      default: 10000,
    },
    ...(maxTemperature > 0
      ? [
          {
            type: 'range',
            name: 'temperature',
            min: 0,
            max: maxTemperature,
            step: 0.05,
            default: 1,
          } satisfies ModelArg,
        ]
      : []),
  ];
}

export type SupportedMime = 'image/' | 'video/' | 'application/pdf';
export function getBaseModelTransform(
  part: zDataPart,
  ...supportedMimes: SupportedMime[]
): zDataPart {
  if (part.type === 'inputFile') {
    if (!supportedMimes.some((m) => part.mime.startsWith(m))) {
      return { type: 'text', value: part.data };
    }
  }
  return part;
}

export function checkToolRequirements(
  tool: zTool,
  context: zToolContext,
  desktop: boolean,
  providers: zCache['providers'],
) {
  const providerNames = [
    ...providers.chat.filter((p) => p.models.length && !p.error).map((p) => p.name),
    ...providers.web.filter((p) => p.available && !p.error).map((p) => p.name),
    ...providers.other.filter((p) => p.available && !p.error).map((p) => p.name),
  ];

  if (tool.requirements?.chat && !context.chat) {
    return false;
  }
  if (tool.requirements?.notIncognito && context.generation.incognito) {
    return false;
  }
  if (
    tool.requirements?.embeddings &&
    (!context.user.settings.embeddingConfig ||
      !providerNames.includes(context.user.settings.embeddingConfig?.provider))
  ) {
    return false;
  }
  if ((tool.requirements?.approval || tool.userInput) && !context.generation.supportsUserInput) {
    return false;
  }
  if (
    tool.requirements?.provider &&
    !tool.requirements.provider.some((p) => providerNames.includes(p))
  ) {
    return false;
  }
  if (tool.requirements?.desktop && !desktop) {
    return false;
  }
  return true;
}

export function checkAllToolRequirements(
  toolGroups: zToolGroup[],
  context: zToolContext,
  desktop: boolean,
  providers: zCache['providers'],
) {
  const result: zToolGroup[] = [];

  for (const toolGroup of toolGroups) {
    const tools = toolGroup.tools.filter((tool) =>
      checkToolRequirements(tool, context, desktop, providers),
    );
    if (tools.length > 0) {
      result.push({ ...toolGroup, tools });
    }
  }

  return result;
}

export function precheckAllToolRequirements(
  toolGroups: zToolGroup[] | undefined,
  user: zUser | undefined,
  chat: zChat | null | undefined,
  incognito: boolean,
  supportsUserInput: boolean,
  desktop: boolean | undefined,
  providers: zCache['providers'] | undefined,
  skills: zSkill[] | undefined,
) {
  return checkAllToolRequirements(
    toolGroups ?? [],
    {
      user: {
        id: '',
        settings: {},
        ...user,
      },
      chat:
        chat !== null
          ? {
              id: '',
              userId: '',
              folderId: '',
              incognito,
              ...chat,
            }
          : null,
      generation: {
        context: [],
        config: {
          provider: '',
          model: '',
          toolGroups: [],
          skills: [],
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        incognito,
        supportsUserInput,
      },
      skills: skills ?? [],
    },
    desktop ?? false,
    providers ?? { chat: [], web: [], other: [] },
  );
}

export function wrapSkill<T extends Record<string, unknown>>(
  skillFiles: { path: string[]; data: string | Uint8Array }[],
  metadata: T,
): (zSkill & T) | null {
  const files = skillFiles
    .filter((f) => f.path.at(-1)?.length)
    .map((f) => ({
      ...f,
      data: typeof f.data === 'string' ? f.data : new TextDecoder().decode(f.data),
    }));
  let skillMd: (typeof files)[number] | undefined;
  for (let i = 0; i < Math.max(...files.map((f) => f.path.length)); i++) {
    skillMd = files.find((f) => f.path.at(i)?.toLowerCase() === 'skill.md');
    if (skillMd) break;
  }
  if (!skillMd) {
    console.log('[wrapSkill] no skill.md found:', files);
    return null;
  }

  const {
    attributes: { name, description, ...attributes },
    body: content,
  } = fm<{ name: string; description: string }>(skillMd.data);
  return {
    ...metadata,
    name,
    description,
    attributes,
    content,
    resources: files
      .filter(
        (f) =>
          f !== skillMd &&
          f.path.slice(0, skillMd.path.length - 1).join('/') ===
            skillMd.path.slice(0, skillMd.path.length - 1).join('/'),
      )
      .map((f) => ({ path: f.path.slice(skillMd.path.length - 1).join('/'), content: f.data })),
  };
}
