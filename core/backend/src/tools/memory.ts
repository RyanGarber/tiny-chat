import { z } from 'zod';
import { type ToolCall, type ToolContext } from './index.ts';
import { getMemorySearch } from '../routes/embeddings.ts';
import { embed } from '../embed.ts';
import { MemoryCategory, MemoryStability } from '../../generated/prisma/enums.ts';
import { createId } from '@paralleldrive/cuid2';
import { type User } from '../server.ts';
import { type Memory } from '../../generated/prisma/client.ts';

const zAddMemory = z.object({
  fact: z
    .string()
    .describe(
      'A self-contained statement about the user that remains fully understandable without any conversation context. Write in third person (e.g. "The user prefers TypeScript over JavaScript").',
    ),
  category: z
    .enum(MemoryCategory)
    .describe(
      "The category this fact belongs to: IDENTITY (who they are), PREFERENCES (what they like or dislike), PROJECTS (what they're building or working on), SKILLS (what they know or are learning), CONSTRAINTS (hard limits on their time, budget, environment, or requirements).",
    ),
  stability: z
    .enum(MemoryStability)
    .describe(
      'How long this fact is expected to remain true: SHORT_TERM (days to weeks, e.g. current task), MEDIUM_TERM (weeks to months, e.g. active project), LONG_TERM (months to years, e.g. job, language preference).',
    ),
  evidence: z
    .union([z.string(), z.array(z.string())])
    .describe('Quotes or paraphrases from the current conversation that justify the update.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'Confidence that this fact is accurate and worth storing, from 0 to 1. Use 0.9+ only for explicitly stated facts. Use 0.6-0.8 for strong implications. Use 0.5 or below for weak implications or guesses.',
    ),
});

const AddMemory = {
  name: 'add_memory',
  description:
    'Add a new memory about the user. Use this tool to provide relevant information about the user that the agent can reference in future interactions. The fact should be self-contained and understandable without any conversation context.',
  parameters: zAddMemory.toJSONSchema(),
  schema: zAddMemory,
  run: async ({ user, message }, params) => {
    if (!message.id) return;

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

    return { success: true };
  },
} satisfies ToolCall<typeof zAddMemory>;

const zUpdateMemory = z.object({
  id: z.cuid2().describe('The exact ID of the memory to update, as shown in your memory context.'),
  fact: z
    .string()
    .describe(
      'The corrected, self-contained statement replacing the old one. Write in third person.',
    ),
  category: z.enum(MemoryCategory).describe('Updated category if it has changed.'),
  stability: z.enum(MemoryStability).describe('Updated stability if it has changed.'),
  evidence: z
    .union([z.string(), z.array(z.string())])
    .describe('Quotes or paraphrases from the current conversation that justify the update.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'Updated confidence from 0 to 1 based on how clearly the user stated the new information.',
    ),
});

const UpdateMemory = {
  name: 'update_memory',
  description:
    'Overwrite an existing memory when the user provides new information that contradicts or refines a known fact. Use the exact memory ID shown in your context. Prefer updating over adding a duplicate.',
  parameters: zUpdateMemory.toJSONSchema(),
  schema: zUpdateMemory,
  run: async ({ user, message }, params) => {
    if (!message.id) return;

    const memory = await globalThis.prisma.$transaction(async (tx) => {
      await tx.memory.delete({
        where: { id: params.id, userId: message.userId },
      });

      return await tx.memory.create({
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

    return { success: true };
  },
} satisfies ToolCall<typeof zUpdateMemory>;

const zDeleteMemory = z.object({
  id: z.cuid2().describe('The exact ID of the memory to delete, as shown in your memory context.'),
  reason: z
    .string()
    .describe(
      'A brief explanation of why this memory is being removed (e.g. "User stated they no longer work at that company").',
    ),
});

const DeleteMemory = {
  name: 'delete_memory',
  description:
    'Remove a memory that the user has explicitly retracted, that has become clearly outdated, or that was saved in error. Do not delete memories just because they seem old — only delete when there is a clear reason.',
  parameters: zDeleteMemory.toJSONSchema(),
  schema: zDeleteMemory,
  run: async ({ message }, params) => {
    if (!message.id) return;

    await globalThis.prisma.memory.delete({
      where: { id: params.id, userId: message.userId },
    });

    return { success: true };
  },
} satisfies ToolCall<typeof zDeleteMemory>;

const zSearchMemory = z.object({
  query: z
    .string()
    .describe(
      'A specific natural-language phrase describing what you\'re looking for (e.g. "programming language preferences" not "user info").',
    ),
  category: z
    .array(z.enum(MemoryCategory))
    .optional()
    .describe(
      'Filter to one or more categories: IDENTITY, PREFERENCES, PROJECTS, SKILLS, CONSTRAINTS. Omit to search all categories.',
    ),
});

const SearchMemory = {
  name: 'search_memory',
  description:
    'Retrieve relevant facts about the user from long-term memory. Call this before answering any question that depends on personal context — preferences, projects, skills, or constraints. Prefer a specific query over a broad one.',
  parameters: zSearchMemory.toJSONSchema(),
  schema: zSearchMemory,
  run: async ({ message, user }, params) => {
    if (!message.id) return;

    const embeddings = await embed(user, [params.query]);
    if (!embeddings) {
      console.warn('Failed to generate embedding for query');
      return;
    }
    return await getMemorySearch(user, embeddings[0], params.category);
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
