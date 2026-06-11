import type { zContextItem, zGenerateInput } from '../../types/chat.ts';
import { zData } from '../../types/chat.ts';
import { getLastPrompt, getNextRunAt, texts } from '../../utils.ts';
import type { zToolGroup } from '../../types/tool.ts';
import type { zSkill } from '../../types/skill.ts';
import type { zUser } from '../../types/user.ts';
import type { GenerationCallbacks } from './generate.ts';
import { format } from 'timeago.js';

export async function buildGenerationInstructions(
  user: zUser,
  callbacks: GenerationCallbacks,
  input: zGenerateInput,
  messages: zContextItem[],
  toolGroups: zToolGroup[],
  skills: zSkill[],
) {
  // TODO - reimplement combined and weighted prompt emebddings
  const prompt = getLastPrompt(messages);
  const promptText = texts(prompt.data);
  const promptEmbedding = prompt.id
    ? await callbacks.getEmbedding({ messageId: prompt.id })
    : await callbacks.embed(promptText);

  console.log(
    `[Instructions] prompt [${prompt.id}]: '${promptText.slice(0, 100)}...' (embedding: ${!!promptEmbedding?.length})`,
  );

  const memories = !input.incognito
    ? await callbacks.searchMemories(promptText, promptEmbedding ?? undefined)
    : [];

  const actions = !input.incognito ? await callbacks.listActions() : [];

  const userInstructions = !input.incognito ? user.settings.instructions : [];

  const date = new Date().toLocaleString('en-US', {
    timeZone: input.timezone ?? 'UTC',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const citations: string[] = [];
  if (input.config.toolGroups?.includes('action')) citations.push('actions');
  if (input.config.toolGroups?.includes('memory')) citations.push('memories');
  if (input.config.toolGroups?.includes('search_web')) citations.push('search_web results');
  const citationsText =
    citations.slice(0, -1).join(', ') +
    (citations.length > 1 ? ' or ' : '') +
    citations.slice(-1)[0];

  return `Formatting re-enabled.

## Instructions

It is currently ${date}. Always consider ${date} the date and time. Never convert to UTC when calling tools.
${input.context.some((m) => m.createdAt) ? "Always take conversation timing into account. Do not assume the chat is continuous. Consider whether the user's intent has changed between messages." : ''}

Render responses in Markdown, Mermaid, and LaTeX — use headers, tables, lists, math, code blocks, and diagrams where helpful.
Important: Always use two dollar signs ($$...$$) for both inline and display math - never one ($...$).

${citationsText ? `When referencing existing ${citationsText}, always cite your sources using GitHub-style citations like [^id] (matching the ID shown exactly).` : ''}
${citationsText ? `Do NOT use simple [^1] indices; only use the explicit [^id] IDs provided in context or in the results. Do not include a footnote section at the end of the response, only the inline citations.` : ''}

## Identity

Only messages labeled [assistant:model=${input.config.model}] were written by you. Other assistant messages were written by different models that may have different knowledge and capabilities.
When referencing past assistant messages, always use the model name - do not say "I" if it wasn't you (${input.config.model}). Critique other assistants' messages from your own perspective when appropriate.

## Tools

${
  toolGroups.length
    ? toolGroups
        .flatMap((t) => t.instructions ?? [])
        .map((e) => `### ${e.heading}\n\n${e.body}`)
        .join('\n\n')
    : '- (none)'
}

## Skills

${skills.length ? skills.map((s) => `### ${s.name}\n\n${s.description}`).join('\n\n') : '- (none)'}

## Context

The user's scheduled actions:

${
  actions.length
    ? actions
        .flatMap((a) =>
          getNextRunAt(a) ? [`- [^${a.id}] ${texts(zData.parse(a.data))} (${a.schedule})`] : [],
        )
        .join('\n')
    : '- (none)'
}

Relevant memories of the user:

${memories.length ? memories.map((m) => `- [^${m.id}] ${m.category}: ${m.fact} (${m.stability} - learned ${format(m.createdAt)})`).join('\n') : '- (none)'}

Instructions from the user:

${userInstructions?.length ? userInstructions.join('\n') : '- (none)'}`;
}
