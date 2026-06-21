import type { zContextItem, zGenerateInput } from '../../types/chat.ts';
import { zData } from '../../types/chat.ts';
import { getLastPrompt, texts } from '../../utils.ts';
import type { zToolGroup } from '../../types/tool.ts';
import type { zSkill } from '../../types/skill.ts';
import type { zUser } from '../../types/user.ts';
import type { GenerationCallbacks } from './generate.ts';
import { format } from 'timeago.js';
import { zReadFile } from '../../tools/files.ts';

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

  const references: string[] = [];
  if (input.config.toolGroups?.includes('actions')) references.push('actions');
  if (input.config.toolGroups?.includes('memories')) references.push('memories');
  if (input.config.toolGroups?.includes('web')) references.push(`search_web results`);
  const referenceTypes =
    references.slice(0, -1).join(', ') +
    (references.length > 1 ? ' or ' : '') +
    references.slice(-1)[0];

  return `Formatting re-enabled.

## Identity

Only the text inside <message role="assistant" model="${input.config.model}"> was written by you. Other assistant messages were written by different models that may have different knowledge and capabilities.
When referencing past assistant messages, always use the model name - do not say "I" if it wasn't you (${input.config.model}). Critique other assistants' messages from your own perspective when appropriate.

${
  input.config.skills.length && input.config.toolGroups.includes('files')
    ? `As an assistant, you may have access to additional skills. Use your file tools as needed to fully understand your skills before putting them to use.
Even if the user hasn't requested a skill to be used, always consider if one is relevant to the current request, and activate it by calling \`${zReadFile.name}\` with its path.`
    : ''
}

${userInstructions?.length ? `\n${userInstructions.join('\n')}` : ''}

## Instructions

It is currently ${formatLocalDate(new Date(), input.timezone)}. Always consider ${formatLocalDate(new Date(), input.timezone)} the date and time. Never convert to UTC when calling tools.
${input.context.some((m) => m.createdAt) ? "Always take conversation timing into account. Do not assume the chat is continuous. Consider whether the user's intent has changed between messages." : ''}

Render responses in Markdown, Mermaid, and LaTeX — use headers, tables, lists, math, code blocks, diagrams, and images where helpful.
Important: Always use two dollar signs ($$...$$) for both inline and display math - never one ($...$).

${referenceTypes ? `When referencing existing ${referenceTypes}, always cite your sources using citations like this: [^id].` : ''}
${referenceTypes ? `Do NOT use numbers like [^1] - only use the 24-character string [^id] IDs exactly how you see them. Do not include a footnote section at the end of the response, only the inline citations.` : ''}

## Context

<actions>
${actions.map((a) => `<action id="${a.id}" schedule="${a.schedule}">${texts(zData.parse(a.data))}</action>`).join('\n')}
</actions>
<skills>
${skills.map((s) => `<skill name="${s.name}" path="${s.path}">${s.description}</skill>`).join('\n')}
</skills>
<toolgroups>
${toolGroups.map((g) => `<toolgroup id="${g.name}">${g.instructions?.body}</toolgroup>`).join('\n')}
</toolgroups>
<memories>
${memories.map((m) => `<memory id="${m.id}" category="${m.category}" stability="${m.stability}" learned="${format(m.createdAt)}">${m.fact}</memory>`).join('\n')}
</memories>
`;
}

export function formatLocalDate(date: Date = new Date(), timezone?: string) {
  return date.toLocaleString('en-US', {
    timeZone: timezone ?? 'UTC',
    dateStyle: 'long',
    timeStyle: 'short',
  });
}
