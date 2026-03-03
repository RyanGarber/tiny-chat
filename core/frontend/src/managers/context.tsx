import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";
import {useSettings} from "@/managers/settings.tsx";
import {useServices} from "@/managers/services.tsx";
import {extractText, scrubText, trpc} from "@/utils.ts";
import {z} from "zod";
import {Author, MemoryCategory, MemoryStability} from "@tiny-chat/core-backend/generated/prisma/enums.ts";
import {MessageOmitted, MessageUnomitted, zData, zDataPart} from "@tiny-chat/core-backend/types.ts";
import {useEmbeddings} from "@/managers/embeddings.tsx";
import {useTasks} from "@/managers/tasks.tsx";

const UPDATE_AFTER_HR = 1;

interface Context {
    init: () => () => void;

    updateMemories: () => Promise<void>;

    getRelevantMemories: (message: MessageOmitted) => Promise<string[]>;
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

export const useMemories = create(subscribeWithSelector<Context>((_, get) => {
    return {
        init: () => {
            void get().updateMemories();
            const interval = setInterval(get().updateMemories, 1000 * 60 * 60 * UPDATE_AFTER_HR);
            return () => clearInterval(interval)
        },

        updateMemories: async () => {
            const chats = await trpc.context.listUpdatedChats.query();
            console.log(`Found ${chats.length} pending chats to memorize`);

            const {addTask, updateTask, removeTask} = useTasks.getState();

            let totalMemories = 0;
            for (let i = 0; i < chats.length; i++) {
                const now = new Date();
                const lastMessage = chats[i].messages[0].createdAt;
                const hours = (now.getTime() - lastMessage.getTime()) / (1000 * 60 * 60);
                if (hours > UPDATE_AFTER_HR) {
                    addTask("memories", "Saving new memories");
                    console.log(`Chat ${chats[i].id} is stale (${hours}h), memorizing...`);
                    const result = await memorizeChat(chats[i].id);
                    totalMemories += result?.memories.length ?? 0;
                    updateTask("memories", i / chats.length * 100, `Learned ${totalMemories} new thing${totalMemories !== -1 ? "s" : ""}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            await removeTask("memories");

            void useEmbeddings.getState().updateEmbeddings();
        },


        getRelevantMemories: async (message: MessageOmitted) => {
            const {getEmbeddingConfig} = useSettings.getState();

            const config = getEmbeddingConfig();
            if (!config) return [];

            const embeddings = await trpc.services.embed.mutate({
                texts: [scrubText(extractText(message.data))],
                config
            });
            if (!embeddings?.length) return [];
            const embedding = embeddings[0];
            const relevantMemories = await trpc.context.listRelevantMemories.mutate({embedding});

            console.log(`Using relevant facts:`, relevantMemories);
            return relevantMemories.map(d => `${d.category}: ${d.fact}`);
        }
    }
}));

async function memorizeChat(chatId: string) {
    const {getMemoryConfig} = useSettings.getState();

    let config = getMemoryConfig();
    console.log("Memory config:", config);
    if (!config) return;
    config = useServices.getState().prepareConfig(config);

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

    const data: zData = [{
        type: "text", value:
            `Task:
1. Write a concise summary (max 5 sentences).
2. Extract long-term memory candidates.
3. Assign confidence scores (0–1).
4. Return JSON in the specified schema.`
    }];

    config.schema = zSchema.toJSONSchema();

    console.log(`Finding memories in chat ${chatId}`);

    const stream = await trpc.services.generate.mutate({
        instruction: instructions,
        context: [
            ...(await trpc.messages.list.query({chatId})),
            ({author: Author.USER, data} satisfies Partial<MessageUnomitted>)
        ],
        config
    });

    let response = "";
    for await (const event of stream) {
        console.log("Received event:", event);
        try {
            const dataPart = zDataPart.parse(event);
            if (dataPart.type === "text") response += dataPart.value;
        } catch (e) {
            console.warn("Stream part is not zDataPart, this may be due to invalid model output", e);
            // Ignore metadata
        }
    }

    console.log("Received response:", response);
    const parsed = zSchema.parse(JSON.parse(response));
    console.log("Parsed response:", parsed);

    delete config.args.schema;
    await trpc.context.createSummary.mutate({chatId, config, text: parsed.summary});
    await trpc.context.createMemories.mutate({chatId, config, memories: parsed.memories});

    console.log(`${parsed.memories.length} memories saved`)
    return parsed;
}

