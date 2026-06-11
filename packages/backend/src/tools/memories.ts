import { z } from 'zod';
import { MemoryCategory, MemoryStability } from '../../generated/prisma/enums.ts';
import { createId } from '@paralleldrive/cuid2';
import type { Tool, ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { searchMemories } from '../routes/context.ts';
import type { MemorySearchResult } from '@tiny-chat/shared/src/types/chat.ts';

const zAddMemoryInput = z.object({
  fact: z.string().describe('The fact about the user.'),
  category: z.enum(MemoryCategory).describe('The category the fact belongs to.'),
  stability: z.enum(MemoryStability).describe('How long the fact is expected to remain true.'),
  evidence: z.union([z.string(), z.array(z.string())]).describe('Evidence to support the fact.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence that the fact is accurate and worth remembering.'),
});
export type zAddMemoryInput = z.infer<typeof zAddMemoryInput>;

const zAddMemoryOutput = z.object({
  created_memory_id: z.cuid2(),
});
export type zAddMemoryOutput = z.infer<typeof zAddMemoryOutput>;

const AddMemory: Tool<typeof zAddMemoryInput, typeof zAddMemoryOutput> = {
  name: 'add_memory',
  description: 'Remember a fact about the user.',
  input: zAddMemoryInput.toJSONSchema(),
  output: zAddMemoryOutput.toJSONSchema(),
  requirements: {
    chat: true,
    notIncognito: true,
  },
  run: async ({ chat, generation }, input) => {
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

    return { created_memory_id: memory.id };
  },
};

const zUpdateMemoryInput = z.object({
  id: z.cuid2().describe('The ID of the memory to update.'),
  fact: z.string().describe('The revised fact about the user.'),
  category: z.enum(MemoryCategory).describe('The category this fact belongs to.'),
  stability: z.enum(MemoryStability).describe('How long this fact is expected to remain true.'),
  evidence: z.union([z.string(), z.array(z.string())]).describe('Evidence to support the fact.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence that the fact is accurate and worth remembering.'),
});
export type zUpdateMemoryInput = z.infer<typeof zUpdateMemoryInput>;

const zUpdateMemoryOutput = z.object({
  updated_memory_id: z.cuid2(),
});
export type zUpdateMemoryOutput = z.infer<typeof zUpdateMemoryOutput>;

const UpdateMemory: Tool<typeof zUpdateMemoryInput, typeof zUpdateMemoryOutput> = {
  name: 'update_memory',
  description: 'Update an existing memory with a revised fact.',
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

    return { updated_memory_id: memory.id };
  },
};

const zDeleteMemoryInput = z.object({
  id: z.cuid2().describe('The ID of the memory to delete.'),
  reason: z
    .string()
    .describe(
      'The fact about the user that makes the previously stored fact inaccurate or irrelevant.',
    ),
});
export type zDeleteMemoryInput = z.infer<typeof zDeleteMemoryInput>;

const zDeleteMemoryOutput = z.object({
  deleted_memory_id: z.cuid2(),
});
export type zDeleteMemoryOutput = z.infer<typeof zDeleteMemoryOutput>;

const DeleteMemory: Tool<typeof zDeleteMemoryInput, typeof zDeleteMemoryOutput> = {
  name: 'delete_memory',
  description:
    'Delete an existing memory because the previously stored fact is no longer relevant or accurate.',
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

export const zSearchMemoryInput = z.object({
  query: z.string(),
  mode: z.enum(['semantic', 'regex']),
});
export type zSearchMemoryInput = z.infer<typeof zSearchMemoryInput>;

export const zSearchMemoryOutput = z.array(
  z.object({
    fact: z.string(),
    category: z.enum(MemoryCategory),
    stability: z.enum(MemoryStability),
    createdAt: z.iso.datetime(),
  }),
);
export type zSearchMemoryOutput = z.infer<typeof zSearchMemoryOutput>;

const SearchMemory: Tool<typeof zSearchMemoryInput, typeof zSearchMemoryOutput> = {
  name: 'search_memory',
  description: 'Search all stored memories.',
  input: zSearchMemoryInput.toJSONSchema(),
  output: zSearchMemoryOutput.toJSONSchema(),
  requirements: {
    embeddings: true,
    notIncognito: true,
  },
  run: async ({ user, callbacks }, input) => {
    const result: MemorySearchResult[] = [];

    if (input.mode === 'semantic') {
      const embedding = await callbacks.embed(input.query);
      const matches = await searchMemories(user, input.query, embedding ?? undefined, 10);
      for (const match of matches) {
        result.push(match);
      }
    } else if (input.mode === 'regex') {
      const memories = await globalThis.prisma.memory.findMany({
        where: { userId: user.id },
      });
      const matches = memories.filter((m) => new RegExp(input.query, 'i').test(m.fact));
      for (const match of matches) {
        result.push(match);
      }
    }

    return result.map((r) => ({
      fact: r.fact,
      category: r.category,
      stability: r.stability,
      createdAt: r.createdAt.toISOString(),
    }));
  },
};

export const memories: ToolGroup = {
  name: 'memories',
  tools: [AddMemory, UpdateMemory, DeleteMemory, SearchMemory],
  instructions: {
    heading: 'Memories',
    body: `Any time the user shares information that could improve future chats, store it as memory, even if it was only mentioned once.
If unsure whether something is worth remembering, ask the user if they'd like it remembered, and add it if they say yes.`,
  },
};
