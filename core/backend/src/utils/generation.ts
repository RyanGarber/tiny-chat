import { getMemoryContext, getQueryEmbedding } from '../routes/embeddings.ts';
import { type User } from '../server.ts';
import {
  type ContextItem,
  getNextRunAt,
  type MessageUnomitted,
  normalizeText,
  texts,
  type zConfig,
  zData,
  type zDataPart,
  type zGenerateInput,
} from '../types.ts';
import { Author, type Chat, type File } from '../../generated/prisma/client.ts';
import { searchFiles } from '../tools/file.ts';
import { format } from 'timeago.js';
import { chatProviders } from '../providers/chat/index.ts';

async function buildGenerationInstructions(
  user: User,
  messages: ContextItem[],
  config: zConfig,
  chat?: Chat,
  timezone?: string,
) {
  const memories = chat && !chat.incognito ? await getMemoryContext(user, messages) : [];

  const actions =
    chat && !chat.incognito
      ? await globalThis.prisma.action.findMany({
          where: { userId: chat.userId },
        })
      : [];

  const userInstructions = chat && !chat.incognito ? user.settings.instructions : [];

  const date = new Date().toLocaleString('en-US', {
    timeZone: timezone ?? 'UTC',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    `Formatting re-enabled.

## Instructions

It is currently ${date}. Always consider ${date} the date and time. Never convert to UTC when calling tools.
Always take conversation timing into account. Do not assume the chat is continuous. Consider whether the user's intent has changed between messages.
For information that does not change often, such as historical facts, scientific principles, or general knowledge, you can rely on your training data.
For information that does change often, such as news, current events, and coding, always search the web to get the most up-to-date information.

Render responses in Markdown — use headers, tables, lists, and code blocks where helpful. Use LaTeX for math, always with \\(...\\) for inline and \\[...\\] for display. Keep paragraphs short.
## Identity

This conversation may include responses from multiple AI models. Your model name is "${config.model}".
Only messages labeled [assistant:model=${config.model}] were written by you. Other assistant messages were written by different models that may have different knowledge and capabilities.
When referencing past assistant messages, always use the model name - do not say "I" if it wasn't "${config.model}". Critique past assistant messages from your own perspective when appropriate.

## Context

The user's scheduled actions:

${
  actions.length
    ? (
        await Promise.all(
          actions.flatMap(async (a) =>
            (await getNextRunAt(a))
              ? [`- [${a.id}] ${texts(zData.parse(a.data))} (${a.schedule})`]
              : [],
          ),
        )
      ).join('\n')
    : '- (none)'
}

Relevant memories of the user:

${memories.length ? memories.map((m) => `- ${m}`).join('\n') : '- (none)'}

## Actions

Actions allow for prompts to be sent to models automatically on a specific schedule.
If the user asks to be kept up-to-date on a topic, use the add_action tool to create an action for it.
If regular updates would be useful for a topic, but the user hasn't asked, ask proactively if they'd like to be kept up-to-date and create an action if so.

## Memories

Any time the user shares information that could improve future chats, store it as memory, even if it was only mentioned once.
Add anything that could be useful in the future, even if it's not obvious at the moment.
If unsure whether something is worth remembering, ask the user if they'd like it remembered, and add it if they say yes.

## Legislation

Various tools are available for directly querying US legislative systems.
When asked about the status of bill(s), use the list_sessions tool to find the relevant legislative session and list_bills to find the relevant bill(s).
For more detailed info on bills, such as party affiliation and precise status updates, use the view_bill tool.

## Citations

When referencing existing actions, memories, or search_web results, always cite your sources using footnotes like [^id] (matching the ID shown exactly).
Do NOT use simple [^1] indices; only use the explicit [^id] IDs provided in context or in the results.

## Important
Do not bring up or make connections to a memory unless it is directly relevant to the current conversation.
If you say you will remember something, or will do something in the future, call the appropriate add_memory or add_action tool.
When asking the user a question, always use the appropriate \`reply_\` tool instead of writing the question in text. Do not call the tool and write the question in text as well - only call the tool.` +
    (userInstructions?.length
      ? `

## User

The user provided the following instructions:

${userInstructions.join('\n')}`
      : '')
  );
}

export async function buildGeneration(
  user: User,
  input: zGenerateInput,
  messages: ContextItem[],
  chat?: Chat,
) {
  const config = await useConfigDefaults(user, input.config);
  console.log('Handling message with data:', messages[messages.length - 1]?.data);

  const context: ContextItem[] = await Promise.all(
    messages.map(async (m, i) => {
      let isFirstText = true;

      const uploadFiles: Record<string, File[]> = {};
      const uploadFileContexts: Record<string, string> = {};
      for (const upload of m.data.filter(
        (d): d is Extract<zDataPart, { type: 'upload' }> => d.type === 'upload',
      )) {
        uploadFiles[upload.id] = await globalThis.prisma.file.findMany({
          where: { uploadId: upload.id },
        });
        const query = await getQueryEmbedding(user, messages);
        if (query) {
          uploadFileContexts[upload.id] = await searchFiles(
            [m],
            query.query,
            query.queryEmbedding,
            3,
          );
        }
      }

      return {
        ...m,
        data: m.data.flatMap((p): zDataPart[] => {
          if (p.type === 'upload') {
            console.log(
              `Handling upload '${p.name}' with ID ${p.id} and ${uploadFiles[p.id]?.length ?? 0} file(s)`,
            );
            if (uploadFiles[p.id]?.length === 1) {
              return [
                { type: 'text', value: `Uploaded file (${p.name}):` },
                {
                  type: 'inputFile',
                  name: uploadFiles[p.id][0].path[0],
                  mime: uploadFiles[p.id][0].mime,
                  data: Buffer.from(uploadFiles[p.id][0].data).toString('base64'),
                },
              ];
            } else if (uploadFiles[p.id]?.length) {
              const buildFileTreeMarkdown = (files: (typeof uploadFiles)[string]) => {
                const tree: Record<string, unknown> = {};

                for (const file of files) {
                  let node = tree;
                  for (let i = 0; i < file.path.length - 1; i++) {
                    const segment = file.path[i];
                    node[segment] ??= {};
                    node = node[segment] as Record<string, unknown>;
                  }
                  const filename = file.path[file.path.length - 1];
                  node[filename] = null; // leaf = file
                }

                const renderTree = (node: Record<string, unknown>, prefix = ''): string => {
                  const entries = Object.entries(node);
                  return entries
                    .map(([name, children], i) => {
                      const isLast = i === entries.length - 1;
                      const connector = isLast ? '└── ' : '├── ';
                      const childPrefix = prefix + (isLast ? '    ' : '│   ');
                      if (children === null) {
                        return `${prefix}${connector}${name}`;
                      }
                      const subtree = renderTree(children as Record<string, unknown>, childPrefix);
                      return `${prefix}${connector}${name}/\n${subtree}`;
                    })
                    .join('\n');
                };

                return '```\n' + renderTree(tree) + '\n```';
              };
              const treeMarkdown = buildFileTreeMarkdown(uploadFiles[p.id]);
              console.log(
                'File context:',
                uploadFileContexts[p.id]
                  .split('---')
                  .map((c) => c.trim().slice(0, 1000))
                  .join('\n\n---\n\n'),
              );
              return [
                {
                  type: 'text',
                  value: `Uploaded files (${p.name}):\n${treeMarkdown}\n\n---${uploadFileContexts[p.id]}`,
                },
              ];
            }
          }
          if (p.type === 'text') {
            let value = normalizeText(p.value).replace(/((?:^::>:: .*$\n?)+)/gm, (block) => {
              const lines = block
                .trim()
                .split('\n')
                .map((l) => l.replace(/^::>:: /, ''));
              let referencedModel = '';
              let contentLines = lines;
              if (lines[0].startsWith('::model=') && lines[0].endsWith('::')) {
                referencedModel = lines[0].slice('::model='.length, -2);
                contentLines = lines.slice(1);
              }
              const prefix = referencedModel
                ? `Earlier, ${referencedModel === input.config.model ? 'you' : referencedModel} said:\n`
                : '';
              return prefix + contentLines.map((l) => `> ${l}`).join('\n') + '\n';
            });
            if (isFirstText && m.id) {
              let heading;
              if (m.author === Author.USER) {
                heading = `[user]\n`;
                if (i !== 0) {
                  const previous = messages[i - 1];
                  if (previous.id) {
                    const delay = format(previous.createdAt, undefined, {
                      relativeDate: m.createdAt,
                    }).replace(' ago', '');
                    if (delay !== 'just now') {
                      heading += `[Conversation timing: ${delay} ${delay.endsWith('s') ? 'have' : 'has'} passed since the last message.]\n`;
                    }
                  }
                }
              } else {
                heading = `[assistant:model=${m.config.model}]\n`;
              }
              value = heading + '\n' + value;
              isFirstText = false;
            }
            return [{ ...p, value }];
          }
          return [p];
        }),
      };
    }),
  );

  context.splice(0, context.length, ...splitToolResults(context));

  const defaultInstructions = await buildGenerationInstructions(
    user,
    context,
    config,
    chat,
    input.timezone,
  );

  console.log(
    'Built context:',
    context
      .filter((m) => m.data.some((d) => d.type === 'text' && d.value.trim() !== ''))
      .map(
        (m) =>
          `<${m.author}> ${texts(m.data)
            .replace(/\[[^\]\n]+]/g, '')
            .replace('\n', ' ')
            .slice(0, 100)}`,
      )
      .join('\n'),
    'And instructions:',
    input.overrideInstructions ?? defaultInstructions,
  );

  return { context, instructions: input.overrideInstructions ?? defaultInstructions };
}

function splitToolResults(context: ContextItem[]) {
  const messages: ContextItem[] = [];
  for (const original of context) {
    const parts = zData.parse(original.data);
    const message = { ...original, data: [] } as MessageUnomitted;

    for (const part of parts) {
      const isCurrentToolResult = part.type === 'toolResult';
      const hasToolResult = message.data.some((p) => p.type === 'toolResult');
      const hasNonToolResult = message.data.some((p) => p.type !== 'toolResult');

      // If transitioning between toolResult and non-toolResult blocks, push and reset
      if ((isCurrentToolResult && hasNonToolResult) || (!isCurrentToolResult && hasToolResult)) {
        messages.push({ ...message });
        message.data = [];
      }

      message.data.push(part);

      // Correctly assign the author for the current block
      if (isCurrentToolResult) {
        message.author = Author.USER;
      } else if (part.type === 'toolCall') {
        message.author = Author.MODEL;
      } else {
        message.author = original.author;
      }
    }
    if (message.data.length) messages.push(message);
  }
  return messages;
}

async function useConfigDefaults(user: User, config: zConfig) {
  const provider = chatProviders.find((s) => s.name === config.provider);
  if (!provider) throw new Error(`Provider ${config.provider} not found`);
  const args = (await provider.getModels(user)).find((m) => m.name === config.model)?.args ?? [];
  console.log('Model args:', args);
  const inputArgs = (config.args ?? {}) as Record<string, unknown>;
  for (const arg of args) {
    if (inputArgs?.[arg.name] === undefined) {
      console.log(`Using default value for arg ${arg.name}:`, arg.default);
      if (config.args === undefined) config.args = {};
      inputArgs[arg.name] = arg.default;
    }
  }
  config.args = inputArgs;
  return config;
}
