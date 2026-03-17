import type { IncomingMessage, ServerResponse } from 'http';
import { auth, toHeaders, type User } from './server.ts';
import type { zGenerateOutput } from './types.ts';
import { getNextRunAt } from './types.ts';
import {
  type ContextItem,
  type MessageUnomitted,
  normalizeText,
  texts,
  type zConfig,
  zData,
  type zDataPart,
  zGenerateInput,
} from './types.ts';
import { chatProviders } from './providers/chat/index.ts';
import { Author, type Chat } from '../generated/prisma/client.ts';
import { tools } from './tools/index.ts';
import { getMemoryContext } from './routes/embeddings.ts';
import { format } from 'timeago.js';

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

    const generation = generate(session.user, input, controller);
    for await (const event of generation) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
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
      tools({ user, message, chat, generateInput: input }),
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

      const tool = tools({ user, message, chat, generateInput: input }).find(
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
      }

      try {
        const params = tool.schema.parse(part.args);
        console.log(`Tool '${part.name}' called, running with args:`, params);
        const value = await tool.run(
          { user, message: message, chat, generateInput: input },
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
      console.log(
        `Tool '${(part as Extract<zDataPart, { type: 'toolResult' }>).name}' finished with result:`,
        part,
      );
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
  const memories = chat && !chat.incognito ? await getMemoryContext(user, messages) : [];

  const actions = chat
    ? await globalThis.prisma.action.findMany({
        where: { chatId: chat.id },
      })
    : [];

  const context: ContextItem[] = messages.map((m, i) => {
    let isFirstText = true;
    let fileNumber = 1;
    return {
      ...m,
      data: m.data.flatMap((d): zDataPart[] => {
        if (d.type === 'file') {
          return [{ type: 'text', value: `Attached file #${fileNumber++} (${d.name}):` }, d];
        }
        if (d.type === 'text') {
          let value = normalizeText(d.value).replace(/((?:^::>:: .*$\n?)+)/gm, (block) => {
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
          return [{ ...d, value }];
        }
        return [d];
      }),
    };
  });

  context.splice(0, context.length, ...splitToolResults(context));

  // TODO - use XML? (multiline rrules, better model inference, etc)
  const userInstructions = chat && !chat.incognito ? user.settings.instructions : [];
  const defaultInstructions =
    `Formatting re-enabled.

## Instructions

Today's date is ${new Date().toLocaleDateString()}. For time-sensitive topics (news, software, etc.), search rather than relying on training data.
Always take conversation timing into account. Do not assume the chat is continuous. Consider whether the user's intent has changed between messages.

Render responses in Markdown — use headers, tables, lists, and code blocks where helpful. Use LaTeX for math. Keep paragraphs short.

## Identity

This conversation may include responses from multiple AI models. Your model name is "${config.model}".
Only messages labeled [assistant:model=${config.model}] were written by you. Other assistant messages were written by different models that may have different knowledge and capabilities.
When referencing past assistant messages, always use the model name - do not say "I". Critique past assistant messages from your own perspective when appropriate.

Critical: Do not include the [assistant:model=...] label in your response.

## Context

The user's scheduled actions in this chat:

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

Relevant memories of the user across all chats:

${memories.length ? memories.map((m) => `- ${m}`).join('\n') : '- (none)'}

## Actions

Actions allow for prompts to be sent automatically on a recurring schedule.
If the user asks for regular updates on a topic, use the add_action tool to create an action for it.
If regular updates would be useful for a topic, but the user hasn't asked yet, ask proactively if they'd like an action created.

## Memories

When the user shares information that could improve future chats, store it as memory even if it was mentioned only once.
Save anything that could be useful in the future, even if it's not obvious now. When unsure, prefer storing the memory with an appropriate confidence score rather than skipping it entirely.
When discussing code, pay special attention to the user's tech stack, environment, architectural decisions, and pain points.
SHORT_TERM and MEDIUM_TERM memories are encouraged for active conversations, experiments, or temporary workflows.
Use search_memory to find more when it could improve the response.` +
    (userInstructions?.length
      ? `

## User

The user provided the following instructions:

${userInstructions.join('\n')}`
      : '');

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
      if (part.type === 'toolResult' && message.data.find((p) => p.type !== 'toolResult')) {
        messages.push({ ...message });
        message.data = [];
        message.author = Author.USER;
      }
      if (part.type !== 'toolResult' && message.data.find((p) => p.type === 'toolResult')) {
        messages.push({ ...message });
        message.data = [];
        message.author = Author.MODEL;
      }
      message.data.push(part);
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
