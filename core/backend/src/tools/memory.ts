import { z } from 'zod';
import { type ToolCall, type ToolContext } from './index.ts';
import { getMemorySearch, prepareMemories } from '../routes/embeddings.ts';
import { embed } from '../utils/embed.ts';
import { MemoryCategory, MemoryStability } from '../../generated/prisma/enums.ts';
import { createId } from '@paralleldrive/cuid2';
import { type User } from '../server.ts';
import { type Memory } from '../../generated/prisma/client.ts';

const zAddMemory = z.object({
  fact: z.string().describe('A fact about the user.'),
  category: z.enum(MemoryCategory).describe('The category the fact belongs to.'),
  stability: z.enum(MemoryStability).describe('How long the fact is expected to remain true.'),
  evidence: z.union([z.string(), z.array(z.string())]).describe('Evidence to support the fact.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence that the fact is accurate and worth remembering.'),
});

const AddMemory = {
  name: 'add_memory',
  description: 'Remember a fact about the user.',
  parameters: zAddMemory.toJSONSchema(),
  schema: zAddMemory,
  run: async ({ user, message }, params) => {
    if (!message.id) throw new Error('Cannot use tool in this context');

    const memory = await globalThis.prisma.memory.create({
      data: {
        id: createId(),
        user: { connect: { id: message.userId } },
        folder: { connect: { id: message.folderId } },
        chat: { connect: { id: message.chatId } },
        message: { connect: { id: message.id } },
        config: message.config,
        fact: params.fact,
        category: params.category,
        stability: params.stability,
        evidence: typeof params.evidence === 'string' ? [params.evidence] : params.evidence,
        confidence: params.confidence,
      },
    });

    await embedMemory(user, memory);

    return { success: true, memoryId: memory.id };
  },
} satisfies ToolCall<typeof zAddMemory>;

const zUpdateMemory = z.object({
  id: z.cuid2().describe('The ID of the memory to update.'),
  fact: z.string().describe('A fact about the user.'),
  category: z.enum(MemoryCategory).describe('The category this fact belongs to.'),
  stability: z.enum(MemoryStability).describe('How long this fact is expected to remain true.'),
  evidence: z.union([z.string(), z.array(z.string())]).describe('Evidence to support the fact.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence that the fact is accurate and worth remembering.'),
});

const UpdateMemory = {
  name: 'update_memory',
  description: 'Update an existing memory.',
  parameters: zUpdateMemory.toJSONSchema(),
  schema: zUpdateMemory,
  run: async ({ user, message }, params) => {
    if (!message.id) throw new Error('Cannot use tool in this context');

    const memory = await globalThis.prisma.$transaction(async (tx) => {
      await tx.memory.delete({
        where: { id: params.id, userId: message.userId },
      });

      return tx.memory.create({
        data: {
          id: createId(),
          user: { connect: { id: message.userId } },
          folder: { connect: { id: message.folderId } },
          chat: { connect: { id: message.chatId } },
          message: { connect: { id: message.id } },
          config: message.config,
          fact: params.fact,
          category: params.category,
          stability: params.stability,
          evidence: typeof params.evidence === 'string' ? [params.evidence] : params.evidence,
          confidence: params.confidence,
        },
      });
    });

    await embedMemory(user, memory);

    return { success: true, memoryId: memory.id };
  },
} satisfies ToolCall<typeof zUpdateMemory>;

const zDeleteMemory = z.object({
  id: z.cuid2().describe('The ID of the memory to delete.'),
});

const DeleteMemory = {
  name: 'delete_memory',
  description: 'Delete an existing memory.',
  parameters: zDeleteMemory.toJSONSchema(),
  schema: zDeleteMemory,
  run: async ({ message }, params) => {
    if (!message.id) throw new Error('Cannot use tool in this context');

    await globalThis.prisma.memory.delete({
      where: { id: params.id, userId: message.userId },
    });

    return { success: true };
  },
} satisfies ToolCall<typeof zDeleteMemory>;

const zSearchMemory = z.object({
  query: z.string(),
  mode: z.enum(['semantic', 'regex']),
});

const SearchMemory = {
  name: 'search_memory',
  description: 'Search all stored memories.',
  parameters: zSearchMemory.toJSONSchema(),
  schema: zSearchMemory,
  run: async ({ message, user }, params) => {
    if (!message.id) throw new Error('Cannot use tool in this context');

    if (params.mode === 'semantic') {
      const embeddings = await embed(user, [params.query]);
      if (!embeddings) {
        throw new Error('Failed to generate embedding for query');
      }
      return await getMemorySearch(user, embeddings[0]);
    } else if (params.mode === 'regex') {
      const memories = await globalThis.prisma.memory.findMany({
        where: { userId: message.userId },
      });
      return prepareMemories(memories.filter((m) => new RegExp(params.query, 'i').test(m.fact)));
    }
  },
} satisfies ToolCall<typeof zSearchMemory>;

async function embedMemory(user: User, memory: Memory) {
  const embeddings = await embed(user, [memory.fact]);
  if (!embeddings) {
    console.warn('Failed to generate embedding for memory:', memory.id);
    return;
  }
  await globalThis.prisma
    .$queryRaw`UPDATE memory SET embedding = ${JSON.stringify(embeddings[0])}::vector WHERE id = ${memory.id}`;
  console.log('Saved embedding for memory', memory.id);
}

export default function tools({ user, chat }: ToolContext) {
  if (!user.settings.embeddingConfig) return [];
  return chat && !chat.incognito ? [AddMemory, UpdateMemory, DeleteMemory, SearchMemory] : [];
}
