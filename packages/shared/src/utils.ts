import type { Action, Message } from '../../backend/generated/prisma/client.ts';
import type { MessageState, ModelArg, zChat, zContextItem, zDataPart } from './types/chat.ts';
import { zConfig, zData, zMetadata } from './types/chat.ts';
import type { zSkill } from './types/skill.ts';
import type { zTool, zToolContext, zToolGroup } from './types/tool.ts';
import type { zCache, zUser } from './types/user.ts';
import { decodeTextLossy, isTextAdjacent } from './utils/files.ts';

export { snippetText } from './utils/snippet.ts';

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

export function scrubText(text: string, maxLength = -1): string {
  text = text
    .replace(/(:{1,3})[a-zA-Z0-9-]+(?:\[.*?])?(?:{.*?})?([.\n]*)\1/g, '$2') // Remove directives
    .replace(/!\[.*?]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)]\((.*?)\)/g, '$1') // Remove links but keep text
    .replace(/(`{1,3})(.*?)\1/g, '$2') // Remove inline code and code blocks
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
    .replace(/([*_])(.*?)\1/g, '$2') // Remove italics
    .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
    .replace(/#+\s?(.*)/g, '$1') // Remove headings
    .replace(/>\s?(.*)/g, '$1') // Remove blockquotes
    .replace(/-\s?(.*)/g, '$1') // Remove unordered list markers
    .replace(/\d+\.\s?(.*)/g, '$1') // Remove ordered list markers
    .replace(/\n/g, ' ') // Replace multiple newlines with a single newline
    .trim();
  if (maxLength > 0 && text.length > maxLength) {
    return text.substring(0, maxLength) + '...';
  }
  return text;
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
  if (part.type === 'file') {
    if (!supportedMimes.some((m) => part.mime.startsWith(m))) {
      if (isTextAdjacent(part.mime)) {
        const text = decodeTextLossy(part.data, part.mime);
        return { type: 'text', value: text };
      } else {
        return { type: 'text', value: `[Unsupported file: ${part.data}]` };
      }
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
    ...(providers?.chat.filter((p) => p.models.length && !p.error).map((p) => p.name) ?? []),
    ...(providers?.web.filter((p) => p.available && !p.error).map((p) => p.name) ?? []),
    ...(providers?.other.filter((p) => p.available && !p.error).map((p) => p.name) ?? []),
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
  return !(tool.requirements?.desktop && !desktop);
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
        name: '',
        settings: {},
        isEphemeral: false,
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

export function wrapSkill(
  path: string,
  skillFiles: { path: string[]; data: string | Uint8Array }[],
): zSkill | null {
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
  } = fm<{ name: string; description: string }>(skillMd.data);
  if (!name) {
    console.log('[wrapSkill] invalid skill.md:', files);
    return null;
  }

  return {
    name: name,
    path: `${[path, ...skillMd.path].join('/')}`,
    description: description,
    attributes: attributes,
  };
}

export function isModelVersion(test: string, ...groups: string[]) {
  test = test.replace(/[+_.:]/g, '-');
  groups = groups.map((group) => group.replace(/[+_.:]/g, '-'));
  return groups.some((group) =>
    group.split(' ').every((match) => new RegExp(`(?:^|\\W)(${match})(?:\\W|$)`, 'i').test(test)),
  );
}

export function getLastPrompt(context: zContextItem[]): zContextItem {
  for (let i = context.length - 1; i >= 0; i--) {
    if (context[i].author === 'USER' && texts(context[i].data).length > 0) {
      return context[i];
    }
  }
  throw new Error('No user message in context');
}

export function uploadIds(context: zContextItem[]) {
  return context.flatMap((m) =>
    m.data
      .flat()
      .filter((d) => d.type === 'upload')
      .map((u) => u.id),
  );
}
