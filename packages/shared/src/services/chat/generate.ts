import {
  type ChatProvider,
  runGeneration,
  type StreamTextOptions,
} from '../../providers/chat/index.ts';
import type {
  ChatSearchResult,
  FileSearchResult,
  MemorySearchResult,
  zChat,
  zData,
  zDataPart,
  zGenerateInput,
  zGenerateOutput,
  zMetadata,
} from '../../types/chat.ts';
import type { zUser } from '../../types/user.ts';
import type { ToolContext, ToolGroup } from '../../types/tool.ts';
import { buildContext } from './context.ts';
import type { Action, File } from '../../../../backend/generated/prisma/client.ts';
import type { zSkill } from '../../types/skill.ts';
import type { Env } from '../../types/env.ts';

export interface GenerationCallbacks {
  // Embeddings
  embed(text: string): Promise<number[] | null>;
  getEmbedding(input: { messageId?: string }): Promise<number[] | undefined>;

  // Chats
  getChat(id?: string, messageId?: string): Promise<zChat | null>;
  searchChats(text: string, embedding?: number[], limit?: number): Promise<ChatSearchResult[]>;

  // Instruction building (instructions.ts)
  searchMemories(text: string, embedding?: number[], limit?: number): Promise<MemorySearchResult[]>;
  listActions(): Promise<Action[]>;

  // Upload/file handling (context.ts)
  listUploadFiles(uploadId: string): Promise<File[]>;
  searchFiles(
    uploads: string[],
    text: string,
    embedding?: number[],
    limit?: number,
  ): Promise<FileSearchResult[]>;
}

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

// ── Pure generation loop ──────────────────────────────────────────
export async function* generate(
  user: zUser,
  provider: ChatProvider,
  callbacks: GenerationCallbacks,
  toolGroups: ToolGroup[] = [],
  skills: zSkill[] = [],
  input: zGenerateInput,
  data: zData,
  metadata: zMetadata,
  env: Env,
  options?: Partial<Omit<StreamTextOptions, 'system'>>,
): AsyncGenerator<zGenerateOutput> {
  const messageId = input.context.find((m) => !!m.id)?.id;
  const chat = messageId ? await callbacks.getChat(undefined, messageId) : null;

  const toolContext: ToolContext = {
    user,
    chat,
    generation: input,
    skills,
    callbacks,
  };
  const tools = toolGroups.flatMap((g) => g.tools);
  console.log('[Generate] tools:', tools.map((t) => t.name).join(', '));
  console.log('[Generate] skills:', skills.map((s) => s.name).join(', '));

  const { context, instructions } = await buildContext(user, callbacks, input, toolGroups, skills);

  // Agentic loop: keep generating until the model stops calling tools
  while (true) {
    context[context.length - 1].data = data;

    let parts = data[data.length - 1];

    const push = (part: zDataPart): zGenerateOutput => {
      if (!parts) {
        console.warn('[Generate] parts array is undefined - this should not happen');
        data.push([]);
        parts = data[data.length - 1];
      }
      parts.push(part);
      return { type: 'data', value: part };
    };

    try {
      const generation = runGeneration(user, provider, context, input.config, tools, env, {
        ...options,
        system: input.overrideInstructions ?? instructions,
      });

      for await (const event of generation) {
        if (event.type === 'start') {
          console.log('[Generate] starting step with warnings:', event.warnings);
          data.push([]);
          parts = data[data.length - 1];
        }

        if (event.type === 'data') {
          if (event.value.type === 'text') {
            type Text = typeof event.value;
            const acc = parts.find(
              (p): p is Text => p.type === 'text' && p.id === (event.value as Text).id,
            );
            if (acc) {
              acc.value += event.value.value;
              if (event.value?.signature) acc.signature = event.value.signature;
            } else {
              parts.push(event.value);
            }
          } else if (event.value.type === 'thought') {
            type Thought = typeof event.value;
            const acc = parts.find(
              (p): p is Thought => p.type === 'thought' && p.id === (event.value as Thought).id,
            );
            if (acc) {
              acc.value += event.value.value;
              if (event.value?.signature) acc.signature = event.value.signature;
            } else {
              parts.push(event.value);
            }
          } else {
            parts.push(event.value);
          }
        }

        if (event.type === 'end') {
          metadata.push(event.metadata);
        }

        yield event;
      }

      if (options?.abortSignal?.aborted) {
        yield push({ type: 'abort', reason: 'user', message: 'Aborted', details: '' });
        break; // TODO - could this lead to a duplicate abort part?
      }
    } catch (e: any) {
      console.error('[Generate] error during stream:', e);
      yield push({
        type: 'abort',
        reason: e.name === 'AbortError' ? 'user' : 'error',
        message: e.message,
        details: JSON.stringify(e),
      });
      break;
    }

    const toolCalls = parts.filter((p) => p.type === 'toolCall');
    console.log(`[Generate] ${toolCalls.length} tools called:`, toolCalls);

    let stop = false;

    for (const toolCall of toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);

      if (!tool) {
        yield push({
          type: 'toolResult',
          id: toolCall.id,
          name: toolCall.name,
          error: true,
          value: `Tool "${toolCall.name}" not found`,
        });
        continue;
      }

      if (tool.userInput || tool.requirements?.approval) {
        stop = true;
        continue;
      }

      try {
        console.log(`[Generate] running tool ${toolCall.name} with args:`, toolCall.args);
        const value = await tool.run(toolContext, toolCall.args, undefined);
        yield push({ type: 'toolResult', id: toolCall.id, name: toolCall.name, value });
      } catch (e: any) {
        console.warn(`[Generate] error running tool ${toolCall.name}:`, e);
        yield push({
          type: 'toolResult',
          id: toolCall.id,
          name: toolCall.name,
          error: true,
          value: e instanceof Error ? e.message : JSON.stringify(e),
        });
      }
    }

    if (stop || !toolCalls.length || options?.abortSignal?.aborted) {
      console.log('[Generate] ending generation loop');
      break;
    }
  }
}
