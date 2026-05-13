import { z } from 'zod';
import { getMemorySearch, prepareMemories } from '../routes/embeddings.ts';
import { MemoryCategory, MemoryStability } from '../../generated/prisma/enums.ts';
import { createId } from '@paralleldrive/cuid2';
import { type Memory } from '../../generated/prisma/client.ts';
import { embed } from '@tiny-chat/shared/src/services/chat/embed.ts';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import type { zUser } from '@tiny-chat/shared/src/types/user.ts';

const zAddMemoryInput = z.object({
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

const zAddMemoryOutput = z.object({
  created_memory_id: z.cuid2(),
});

const AddMemory: Tool<typeof zAddMemoryInput, typeof zAddMemoryOutput> = {
  name: 'add_memory',
  description: 'Remember a fact about the user.',
  input: zAddMemoryInput.toJSONSchema(),
  output: zAddMemoryOutput.toJSONSchema(),
  requirements: {
    chat: true,
    notIncognito: true,
  },
  run: async ({ user, chat, generation }, input) => {
    const memory = await globalThis.prisma.memory.create({
      data: {
        id: createId(),
        user: { connect: { id: chat!.userId } },
        folder: { connect: { id: chat!.folderId } },
        chat: { connect: { id: chat!.id } },
        message: { connect: { id: generation.context[generation.context.length - 1].id! } },
        config: generation.config,
        fact: input.fact,
        category: input.category,
        stability: input.stability,
        evidence: typeof input.evidence === 'string' ? [input.evidence] : input.evidence,
        confidence: input.confidence,
      },
    });

    void embedMemory(user, memory);

    return { created_memory_id: memory.id };
  },
};

const zUpdateMemoryInput = z.object({
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

const zUpdateMemoryOutput = z.object({
  updated_memory_id: z.cuid2(),
});

const UpdateMemory: Tool<typeof zUpdateMemoryInput, typeof zUpdateMemoryOutput> = {
  name: 'update_memory',
  description: 'Update an existing memory.',
  input: zUpdateMemoryInput.toJSONSchema(),
  output: zUpdateMemoryOutput.toJSONSchema(),
  requirements: {
    notIncognito: true,
  },
  run: async ({ user }, input) => {
    const memory = await globalThis.prisma.$transaction(async (tx) => {
      await tx.memory.delete({
        where: { id: input.id, userId: user.id },
      });

      return tx.memory.update({
        where: {
          id: input.id,
          userId: user.id,
        },
        data: {
          fact: input.fact,
          category: input.category,
          stability: input.stability,
          evidence: typeof input.evidence === 'string' ? [input.evidence] : input.evidence,
          confidence: input.confidence,
        },
      });
    });

    void embedMemory(user, memory);

    return { updated_memory_id: memory.id };
  },
};

const zDeleteMemoryInput = z.object({
  id: z.cuid2().describe('The ID of the memory to delete.'),
});

const zDeleteMemoryOutput = z.object({
  deleted_memory_id: z.cuid2(),
});

const DeleteMemory: Tool<typeof zDeleteMemoryInput, typeof zDeleteMemoryOutput> = {
  name: 'delete_memory',
  description: 'Delete an existing memory.',
  input: zDeleteMemoryInput.toJSONSchema(),
  output: zDeleteMemoryOutput.toJSONSchema(),
  requirements: {
    notIncognito: true,
  },
  run: async ({ user }, input) => {
    await globalThis.prisma.memory.delete({
      where: { id: input.id, userId: user.id },
    });

    return { deleted_memory_id: input.id };
  },
};

const zSearchMemoryInput = z.object({
  query: z.string(),
  mode: z.enum(['semantic', 'regex']),
});

/*const zSearchMemoryOutput = z.array(
  z.object({
    id: z.cuid2(),
    fact: z.string(),
    category: z.enum(MemoryCategory),
    stability: z.enum(MemoryStability),
    evidence: z.array(z.string()),
    confidence: z.number(),
  }),
);*/ // TODO
const zSearchMemoryOutput = z.array(z.string());

const SearchMemory: Tool<typeof zSearchMemoryInput, typeof zSearchMemoryOutput> = {
  name: 'search_memory',
  description: 'Search all stored memories.',
  input: zSearchMemoryInput.toJSONSchema(),
  output: zSearchMemoryOutput.toJSONSchema(),
  requirements: {
    embeddings: true,
    notIncognito: true,
  },
  run: async ({ user }, input) => {
    const result: Awaited<ReturnType<typeof SearchMemory.run>> = [];

    if (input.mode === 'semantic') {
      const embeddings = await embed(user, [input.query], process.env);
      if (!embeddings) throw new Error('Failed to generate embedding for query');
      const matches = await getMemorySearch(user, embeddings[0]);
      for (const match of matches) {
        result.push(match);
      }
    } else if (input.mode === 'regex') {
      const memories = await globalThis.prisma.memory.findMany({
        where: { userId: user.id },
      });
      const matches = memories.filter((m) => new RegExp(input.query, 'i').test(m.fact));
      for (const match of matches) {
        result.push(prepareMemories([match])[0]);
      }
    }

    return result;
  },
};

export const memory: ToolGroup = {
  name: 'memory',
  tools: [AddMemory, UpdateMemory, DeleteMemory, SearchMemory],
  instructions: {
    heading: 'Memories',
    body: `Any time the user shares information that could improve future chats, store it as memory, even if it was only mentioned once.
If unsure whether something is worth remembering, ask the user if they'd like it remembered, and add it if they say yes.`,
  },
};

async function embedMemory(user: zUser, memory: Memory) {
  const embeddings = await embed(user, [memory.fact], process.env);
  if (!embeddings) {
    console.warn('Failed to generate embedding for memory:', memory.id);
    return;
  }
  await globalThis.prisma
    .$queryRaw`UPDATE memory SET embedding = ${JSON.stringify(embeddings[0])}::vector WHERE id = ${memory.id}`;
  console.log('Saved embedding for memory', memory.id);
}
