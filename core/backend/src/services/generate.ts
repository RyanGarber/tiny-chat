import type { IncomingMessage, ServerResponse } from 'http';
import { auth, toHeaders, type User } from '../server.ts';
import type { zGenerateOutput } from '../types.ts';
import {
  type ContextItem,
  type MessageUnomitted,
  normalizeText,
  texts,
  type zConfig,
  zData,
  type zDataPart,
  zGenerateInput,
} from '../types.ts';
import { chatProviders } from '../providers/chat/index.ts';
import { Author, type Chat } from '../../generated/prisma/client.ts';
import { tools } from '../tools/index.ts';
import { getQueryEmbedding } from '../routes/embeddings.ts';
import { format } from 'timeago.js';
import type { File } from '../../generated/prisma/client.ts';
import { searchFiles } from '../tools/file.ts';
import { generateInstructions } from '../utils/consts.ts';

export default async function generateHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
    if (!session?.user) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    const body = await new Promise<string>((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
    const data = JSON.parse(body);
    const input = zGenerateInput.parse(data);

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.socket?.setNoDelay(true);
    res.flushHeaders();

    const generation = generate(session.user, input, controller);
    for await (const event of generation) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  } catch (e: any) {
    console.trace('Error during generation:', e);
    res.write(`error: ${JSON.stringify({ stack: e.stack, message: e.message })}\n\n`);
  } finally {
    res.end();
  }
}

export async function* generate(
  user: User,
  input: zGenerateInput,
  controller: AbortController,
): AsyncGenerator<zGenerateOutput> {
  const provider = chatProviders.find((s) => s.name === input.config.provider);
  if (!provider) return;

  const baseContext: ContextItem[] = [];

  // Prefer persisted rows when IDs are present, then normalize mixed tool results into separate turns.
  const messageDatas = await globalThis.prisma.message.findMany({
    where: {
      id: {
        in: input.context.flatMap((m) => (m.id ? [m.id] : [])),
      },
    },
  });
  for (const item of input.context) {
    const messageData = messageDatas.find((m) => m.id === item.id);
    if (messageData) {
      baseContext.push(messageData as MessageUnomitted);
    } else {
      baseContext.push({ ...item, id: null });
    }
  }

  const chatId = baseContext.find((m): m is MessageUnomitted => !!m.id && !!m.chatId)?.chatId;
  const chat = chatId
    ? await globalThis.prisma.chat.findUniqueOrThrow({
        where: { id: chatId },
      })
    : undefined;

  const { context, instructions } = await buildGenerateInput(
    user,
    baseContext,
    await useConfigDefaults(user, input.config),
    input.overrideInstructions,
    chat,
  );

  // Agentic loop: keep generating until the model stops calling tools
  while (true) {
    const message = context[context.length - 1];

    console.log('Starting turn for message:', message);
    const stream = provider.generate(
      user,
      instructions,
      context,
      input.config,
      controller.signal,
      tools({ user, chat, message, messages: baseContext, generateInput: input }),
    );

    const modelMessage = { ...message, author: Author.MODEL, data: [] } as MessageUnomitted;
    const userMessage = { ...message, author: Author.USER, data: [] } as MessageUnomitted;

    try {
      for await (const event of stream) {
        yield event;

        if (event.type === 'data') {
          modelMessage.data.push(event.value);
        }

        if (event.type === 'special' && event.value.type === 'metadata') {
          modelMessage.metadata = event.value.value; // to push Gemini thoughtSignature into next pass
        }
      }
    } catch (e: any) {
      console.log('Error during generation:', e);
      throw e;
    }

    // Find any tool calls in this pass
    const toolCalls = modelMessage.data.filter((p) => p.type === 'toolCall');
    if (!toolCalls.length) break;

    // Execute each tool and collect results
    let needsUserInput = false;

    for (const part of toolCalls) {
      if (part.type !== 'toolCall') continue;

      const tool = tools({ user, chat, message, messages: baseContext, generateInput: input }).find(
        (t) => t.name === part.name,
      );
      if (!tool) {
        console.log(`Tool '${part.name}' does not exist`);
        userMessage.data.push({
          type: 'toolResult',
          id: part.id,
          name: part.name,
          error: true,
          value: `Tool "${part.name}" not found`,
        });
        continue;
      }

      if (tool.needsUserInput) {
        console.log(`Tool '${part.name}' requires user input, will end turn`);
        needsUserInput = true;
        continue; // TODO - user input should be requested during tool run
        // TODO - tool results should probably be collected?
      }

      try {
        const params = tool.schema.parse(part.args);
        console.log(`Tool '${part.name}' called, running with args:`, params);
        const value = await tool.run(
          { user, chat, message: message, messages: baseContext, generateInput: input },
          params,
        );
        userMessage.data.push({ type: 'toolResult', id: part.id, name: part.name, value });
      } catch (e: any) {
        console.warn(`Tool '${part.name}' threw an error:`, e);
        userMessage.data.push({
          type: 'toolResult',
          id: part.id,
          name: part.name,
          error: true,
          value: e.message ?? String(e),
        });
      }

      if (controller.signal.aborted) {
        console.warn('Aborting generation loop:', controller.signal.reason);
        break;
      }
    }

    // Emit the tool results to the client so the UI can display them
    for (const part of userMessage.data) {
      console.log(`Tool '${(part as Extract<zDataPart, { type: 'toolResult' }>).name}' succeeded`);
      yield { type: 'data', value: part };
    }

    if (needsUserInput) {
      console.log('Ending turn to wait for user input');
      controller.abort('Tool requires user input');
      break;
    }

    if (controller.signal.aborted) {
      console.warn('Aborting generation loop:', controller.signal.reason);
      break;
    }

    // Append the assistant turn and the tool results as a user turn, then loop
    context.push(modelMessage);
    context.push(userMessage);
  }
}

async function buildGenerateInput(
  user: User,
  messages: ContextItem[],
  config: zConfig,
  overrideInstructions?: string,
  chat?: Chat,
) {
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
              const prefix = referencedModel ? `Earlier, ${referencedModel} said:\n` : '';
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

  const defaultInstructions = await generateInstructions(user, context, config, chat);

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
    overrideInstructions ?? defaultInstructions,
  );

  return { context, instructions: overrideInstructions ?? defaultInstructions };
}

export function splitToolResults(context: ContextItem[]) {
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

export async function useConfigDefaults(user: User, config: zConfig) {
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
