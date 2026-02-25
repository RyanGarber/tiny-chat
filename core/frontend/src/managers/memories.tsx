import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";
import {useSettings} from "@/managers/settings.tsx";
import {useServices} from "@/managers/services.tsx";
import {trpc} from "@/utils.ts";
import {z} from "zod";
import {Author, MemoryCategory, MemoryStability} from "@tiny-chat/core-backend/generated/prisma/enums.ts";
import {MessageUnomitted, zDataPart, zDataType} from "@tiny-chat/core-backend/types.ts";

const HOURS_TO_STALE = 1;

interface Memories {
    init: () => () => void;

    memorize: (chatId: string) => Promise<void>;
    findAndMemorize: () => Promise<void>;

    remember: (prompt: string) => Promise<string[]>;
}

const zSchema = z.object({
    summary: z.string().describe("A concise summary of the conversation."),
    memories: z.array(z.object({
        fact: z.string().describe("A self-contained statement that remains understandable without conversation context."),
        category: z.enum(MemoryCategory).describe("The category that the fact belongs to."),
        stability: z.enum(MemoryStability).describe("How long the fact is expected to be relevant."),
        evidence: z.array(z.string()).describe("Quotes or paraphrases supporting the fact."),
        confidence: z.number().min(0).max(1).describe("A confidence score between 0 and 1."),
    })).describe("A list of long-term memory candidates.")
});

export const useMemories = create(subscribeWithSelector<Memories>((_set, get) => {
    return {
        init: () => {
            void get().findAndMemorize();
            const interval = setInterval(get().findAndMemorize, 1000 * 60 * 60 * HOURS_TO_STALE);
            return () => clearInterval(interval)
        },

        memorize: async (chatId) => {
            const {getMemoryConfig} = useSettings.getState();

            let config = getMemoryConfig();
            console.log("Memory config:", config);
            if (!config) return;
            config = useServices.getState().prepareConfig(config);

            const service = useServices.getState().findService(config.service);
            console.log("Memory model found in service:", service);
            if (!service) return;

            const instructions =
                `You analyze conversations to produce long-term memory candidates.

A memory must be:
- Stable over time
- Useful in future conversations
- About user identity, preferences, projects, skills, or constraints

Do NOT extract:
- Temporary requests
- One-time tasks
- Assistant statements
- Jokes

Facts must be:
- Atomic and self-contained
- Explicitly stated or strongly implied by the USER

Do NOT extract:
- Speculation
- Random or unimportant facts

Output valid JSON only.`;

            const data: zDataType = [{
                type: "text", value:
                    `Task:
1. Write a concise summary (max 5 sentences).
2. Extract long-term memory candidates.
3. Assign confidence scores (0–1).
4. Return JSON in the specified schema.`
            }];

            if (service.getFeatures(config.model)?.includes("schema")) config.args.schema = zSchema.toJSONSchema();
            else data.push({type: "text", value: `Schema: ${JSON.stringify(zSchema.toJSONSchema())}`});

            const messages: MessageUnomitted[] = [
                ...(await trpc.messages.list.query({chatId})) as MessageUnomitted[],
                ({author: Author.USER, data} satisfies Partial<MessageUnomitted>) as MessageUnomitted
            ];

            console.log(`Finding memories from ${messages.length} messages in chat ${chatId}`);

            const abortController = new AbortController();
            const stream = service.generate(instructions, messages, config, abortController.signal);

            let response = "";
            for await (const chunk of stream) {
                console.log("Received chunk:", chunk);
                try {
                    const dataPart = zDataPart.parse(chunk);
                    if (dataPart.type === "text") response += dataPart.value;
                } catch {
                    // Ignore metadata
                }
            }

            console.log("Received response:", response);
            const parsed = zSchema.parse(JSON.parse(response));
            console.log("Parsed response:", parsed);

            await trpc.memories.createSummary.mutate({chatId, config, content: response});
            await trpc.memories.createMemories.mutate({chatId, config, memories: parsed.memories});

            console.log(`${parsed.memories.length} memories saved`)
        },

        findAndMemorize: async () => {
            const pending = await trpc.memories.listPendingChats.query();
            console.log(`Found ${pending.length} pending chats to memorize`);
            for (const chat of pending) {
                const now = new Date();
                const lastMessage = chat.messages[0].createdAt;
                const hours = (now.getTime() - lastMessage.getTime()) / (1000 * 60 * 60);
                if (hours > HOURS_TO_STALE) {
                    console.log(`Chat ${chat.id} is stale (${hours}h), memorizing...`);
                    await get().memorize(chat.id);
                }
            }
        },

        remember: async (prompt) => {
            const {getEmbeddingConfig} = useSettings.getState();

            const config = getEmbeddingConfig();
            if (!config) return [];

            const service = useServices.getState().findService(config.service);
            if (!service) return [];

            const memories = (await trpc.memories.listMemories.query()).map(f => `${f.category}: ${f.fact}`);
            const embeddings = await service.embed([prompt, ...memories], config);
            const results = getRelevantMemories(embeddings[0], embeddings.slice(1).map((e, i) => ({
                text: memories[i],
                embedding: e
            })));

            console.log(`Using relevant memories:`, results);
            return results.map(d => d.text);
        }
    }
}));

function getCosineSimilarity(a: number[], b: number[]) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function getRelevantMemories(
    promptEmbedding: number[],
    memories: { text: string; embedding: number[] }[],
    options: {
        maxCount?: number;
        minCount?: number;
        diversityWeight?: number
    } = {}
) {
    if (!memories.length) return [];

    const {maxCount = 10, minCount = 1, diversityWeight = 0.3} = options;

    const scoredMemories = memories.map(c => ({
        ...c,
        score: getCosineSimilarity(promptEmbedding, c.embedding),
    }));

    const mean = scoredMemories.reduce((s, c) => s + c.score, 0) / scoredMemories.length;
    const variance = scoredMemories.reduce((s, c) => s + (c.score - mean) ** 2, 0) / scoredMemories.length;
    const standardDeviation = Math.sqrt(variance);

    const threshold = mean + (standardDeviation / 2);

    let relevantMemories = scoredMemories
        .filter(c => c.score >= threshold)
        .sort((a, b) => b.score - a.score);

    if (relevantMemories.length < minCount) { // fallback
        relevantMemories = scoredMemories.sort((a, b) => b.score - a.score).slice(0, minCount);
    }

    const bestMemories: (typeof scoredMemories[number])[] = [];

    while (bestMemories.length < maxCount && relevantMemories.length) {
        let bestIndex = 0;
        let bestScore = -Infinity;

        for (let i = 0; i < relevantMemories.length; i++) {
            const relevance = relevantMemories[i].score;

            const similarity = bestMemories.length
                ? Math.max(...bestMemories.map(s => getCosineSimilarity(relevantMemories[i].embedding, s.embedding)))
                : 0;

            const mmrScore = ((1 - diversityWeight) * relevance) - (diversityWeight * similarity);

            if (mmrScore > bestScore) {
                bestScore = mmrScore;
                bestIndex = i;
            }
        }

        bestMemories.push(relevantMemories.splice(bestIndex, 1)[0]);
    }

    return bestMemories.map(({text, score}) => ({text, relevance: score}));
}