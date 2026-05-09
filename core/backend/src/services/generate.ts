import type { IncomingMessage, ServerResponse } from 'http';
import { type User } from '../server.ts';
import type { zGenerateOutput } from '../types.ts';
import {
  type ContextItem,
  type MessageUnomitted,
  zConfig as zConfigSchema,
  zData,
  type zDataPart,
  zMetadata,
  type zGenerateInput,
  zGenerateMessageInput,
  zContinueToolCallInput,
  wrapMessageUnomitted,
} from '../types.ts';
import { chatProviders } from '../providers/chat/index.ts';
import { Author } from '../../generated/prisma/client.ts';
import { tools } from '../tools/index.ts';
import { buildGeneration } from '../utils/generation.ts';
import { createId } from '@paralleldrive/cuid2';
import { embedMessage, reorder } from '../routes/messages.ts';
import { authenticateRequest, readBody, sendEvent, setupSSE } from '../utils/sse.ts';

// ── Shared accumulation logic ─────────────────────────────────────

/** Reorder tool results to match the order of their corresponding tool calls. */
export function alignToolResults(data: zDataPart[]): zDataPart[] {
  const toolCalls = data.filter((p) => p.type === 'toolCall');
  const results = data.filter((p) => p.type === 'toolResult');

  if (!toolCalls.length || !results.length) return data;

  const sortedResults: zDataPart[] = [];
  const usedResultIndices = new Set<number>();

  for (const call of toolCalls) {
    const matchIndex = results.findIndex((r, i) => r.id === call.id && !usedResultIndices.has(i));
    if (matchIndex !== -1) {
      sortedResults.push(results[matchIndex]);
      usedResultIndices.add(matchIndex);
    }
  }

  // Append any leftover/unmatched results
  results.forEach((r, i) => {
    if (!usedResultIndices.has(i)) sortedResults.push(r);
  });

  let resultCounter = 0;
  return data.map((part) => {
    if (part.type === 'toolResult') return sortedResults[resultCounter++];
    return part;
  });
}

/** Accumulate a stream of generate events into data/metadata arrays. Yields each event through. */
export async function* generateStream(
  generation: AsyncGenerator<zGenerateOutput>,
  data: zData,
  metadata: zMetadata,
): AsyncGenerator<zGenerateOutput> {
  for await (const event of generation) {
    if (event.type === 'data') {
      if (event.value.type === 'text') {
        const last = data[data.length - 1];
        if (last?.type === 'text') last.value += event.value.value;
        else data.push(event.value);
      } else if (event.value.type === 'thought') {
        const last = data[data.length - 1];
        if (last?.type === 'thought' && event.value.continued) last.value += event.value.value;
        else data.push(event.value);
      } else {
        data.push(event.value);
      }
    }
    if (event.type === 'special' && event.value.type === 'metadata') {
      metadata.push(event.value.value);
    }
    yield event;
  }
}

/** Persist a reply message's accumulated data and embed both messages. */
export async function persistReply(
  user: User,
  replyId: string,
  data: zData,
  metadata: zMetadata,
  userMessageId: string,
) {
  await globalThis.prisma.message.update({
    where: { id: replyId },
    data: { data, metadata },
  });

  const userMessage = await globalThis.prisma.message.findUniqueOrThrow({
    where: { id: userMessageId },
  });
  const replyMessage = await globalThis.prisma.message.findUniqueOrThrow({
    where: { id: replyId },
  });

  await embedMessage(user, userMessage);
  await embedMessage(user, replyMessage);
}

// ── Generate handler (POST /@/generate) ───────────────────────────

export default async function generateHandler(req: IncomingMessage, res: ServerResponse) {
  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const body = await readBody(req);
    const input = zGenerateMessageInput.parse(JSON.parse(body));

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    setupSSE(res);

    // Load the user message and all messages in the chat
    const userMessage = await globalThis.prisma.message.findUniqueOrThrow({
      where: { id: input.messageId, userId: user.id },
    });
    const allMessages = reorder(
      await globalThis.prisma.message.findMany({
        where: { chatId: userMessage.chatId },
      }),
    ).map(wrapMessageUnomitted);

    // Context is everything up to and including the user message
    const userIndex = allMessages.findIndex((m) => m.id === input.messageId);
    const context: ContextItem[] = allMessages.slice(0, userIndex + 1);
    const config = zConfigSchema.parse(userMessage.config);

    // Create or reuse the reply message
    const existingReply = allMessages.find((m) => m.previousId === input.messageId);
    let replyId: string;
    if (existingReply) {
      await globalThis.prisma.message.update({
        where: { id: existingReply.id },
        data: { data: [], metadata: [], createdAt: new Date() },
      });
      replyId = existingReply.id;
    } else {
      replyId = createId();
      await globalThis.prisma.message.create({
        data: {
          id: replyId,
          user: { connect: { id: user.id } },
          folder: { connect: { id: userMessage.folderId } },
          chat: { connect: { id: userMessage.chatId } },
          config,
          author: Author.MODEL,
          data: [],
          metadata: [],
          previous: { connect: { id: input.messageId } },
        },
      });
    }

    // Tell the frontend the reply ID
    sendEvent(res, { type: 'special', value: { type: 'replyId', value: replyId } });

    // Run the generation
    const generation = generate(
      user,
      {
        timezone: input.timezone,
        config,
        context,
        userInput: input.userInput,
        overrideInstructions: input.overrideInstructions,
      },
      controller,
    );

    const data: zData = [];
    const metadata: zMetadata = [];
    for await (const event of generateStream(generation, data, metadata)) {
      sendEvent(res, event);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    // Persist the reply
    await persistReply(user, replyId, data, metadata, input.messageId);
  } catch (e: any) {
    console.trace('Error during generation:', e);
    const errorEvent = {
      type: 'data',
      value: { type: 'abort', reason: 'error', message: e.message ?? String(e), details: e.stack },
    } satisfies zGenerateOutput;
    sendEvent(res, errorEvent);
  } finally {
    res.end();
  }
}

// ── Continue handler (POST /@/generate/continue) ──────────────────

export async function continueHandler(req: IncomingMessage, res: ServerResponse) {
  const user = await authenticateRequest(req, res);
  if (!user) return;

  try {
    const body = await readBody(req);
    const input = zContinueToolCallInput.parse(JSON.parse(body));

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    setupSSE(res);

    // Load the model message
    const modelMessage = await globalThis.prisma.message.findUniqueOrThrow({
      where: { id: input.messageId, userId: user.id },
    });
    const currentData = zData.parse(modelMessage.data);
    const currentMetadata = zMetadata.parse(modelMessage.metadata);

    // Check if this result was already added
    const alreadyAnswered = currentData.some(
      (p) => p.type === 'toolResult' && p.id === input.toolCallId && p.name === input.toolName,
    );
    if (alreadyAnswered) {
      res.end();
      return;
    }

    // Add the tool result and align ordering to match tool calls
    currentData.push({
      type: 'toolResult',
      id: input.toolCallId,
      name: input.toolName,
      value: input.value,
    });
    const alignedData = alignToolResults(currentData);
    alignedData.forEach((p, i) => (currentData[i] = p));

    // Count calls vs results
    const toolCallsCount = currentData.filter((p) => p.type === 'toolCall').length;
    const toolResultsCount = currentData.filter((p) => p.type === 'toolResult').length;

    // Save intermediate state
    await globalThis.prisma.message.update({
      where: { id: input.messageId },
      data: { data: currentData },
    });

    // If there are still unanswered tools, stop here
    if (toolResultsCount < toolCallsCount) {
      console.log(`Waiting for more tool inputs (${toolResultsCount}/${toolCallsCount})`);
      res.end();
      return;
    }

    // All tool calls answered — re-enter generation loop
    // Find the user message (previous of this model message)
    const userMessage = await globalThis.prisma.message.findUniqueOrThrow({
      where: { id: modelMessage.previousId! },
    });
    const allMessages = reorder(
      await globalThis.prisma.message.findMany({
        where: { chatId: modelMessage.chatId },
      }),
    ).map(wrapMessageUnomitted);

    const userIndex = allMessages.findIndex((m) => m.id === userMessage.id);
    const context: ContextItem[] = allMessages.slice(0, userIndex + 1);
    const config = zConfigSchema.parse(modelMessage.config);

    // Append the current model data + tool results as context for the next generation pass
    const modelCtx = {
      ...wrapMessageUnomitted(modelMessage),
      data: currentData,
      author: Author.MODEL,
    } as MessageUnomitted;
    context.push(modelCtx);

    // Tell frontend we're using the same reply
    sendEvent(res, { type: 'special', value: { type: 'replyId', value: input.messageId } });

    const generation = generate(
      user,
      {
        timezone: input.timezone,
        config,
        context,
        userInput: true,
        overrideInstructions: undefined,
      },
      controller,
    );

    const data: zData = [...currentData];
    const metadata: zMetadata = [...currentMetadata];
    for await (const event of generateStream(generation, data, metadata)) {
      sendEvent(res, event);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    await persistReply(user, input.messageId, data, metadata, userMessage.id);
  } catch (e: any) {
    console.trace('Error during continue:', e);
    const errorEvent = {
      type: 'data',
      value: { type: 'abort', reason: 'error', message: e.message ?? String(e), details: e.stack },
    } satisfies zGenerateOutput;
    sendEvent(res, errorEvent);
  } finally {
    res.end();
  }
}

// ── Pure generation loop (unchanged) ──────────────────────────────

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

  const { context, instructions } = await buildGeneration(user, input, baseContext, chat);

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
          modelMessage.metadata.push(event.value.value); // to push Gemini thoughtSignature into next pass
        }
      }
    } catch (e: any) {
      console.error('Error during generation stream:', e);
      yield {
        type: 'data',
        value: {
          type: 'abort',
          reason: 'error',
          message: e.message ?? String(e),
          details: e.stack,
        },
      } satisfies zGenerateOutput;
      modelMessage.data.push({
        type: 'abort',
        reason: 'error',
        message: e.message ?? String(e),
        details: e.stack,
      });
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
