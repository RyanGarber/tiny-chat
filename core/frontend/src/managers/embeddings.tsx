import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";
import {useServices} from "@/managers/services.tsx";
import {useSettings} from "@/managers/settings.tsx";
import {extractText, scrubText, trpc} from "@/utils.ts";
import {useTasks} from "@/managers/tasks.tsx";

interface Embeddings {
    init: () => Promise<void>;

    updateEmbeddings: () => Promise<void>;
}

export const useEmbeddings = create(subscribeWithSelector<Embeddings>((_, get) => ({
    init: async () => {
        void get().updateEmbeddings();
    },

    updateEmbeddings: async () => {
        const needed = await trpc.embeddings.listNeeded.query();
        const {setTask, updateTask, removeTask} = useTasks.getState();

        if (needed.messages.length || needed.summaries.length || needed.memories.length) {
            setTask("embeddings", "Generating embeddings");
        }

        if (needed.messages.length) {
            console.log(`Generating embeddings for ${needed.messages.length} ${needed.summaries.length === 1 ? "message" : "messages"}`);
            updateTask("embeddings", 0, `${needed.messages.length} message${needed.messages.length === 1 ? "" : "s"}`);
            for (let i = 0; i < needed.messages.length; i += 100) {
                const messages = needed.messages.slice(i, i + 100);
                const embeddings = await embed(...messages.map(m => scrubText(extractText(m.data))));
                await trpc.embeddings.saveMessages.mutate(new Map(embeddings?.map((e, i) => ([messages[i].id, e]))));
                await new Promise(resolve => setTimeout(resolve, 1000));
                updateTask("embeddings", i / needed.messages.length);
            }
        }

        if (needed.summaries.length) {
            console.log(`Generating embeddings for ${needed.summaries.length} ${needed.summaries.length === 1 ? "summary" : "summaries"}`);
            updateTask("embeddings", 0, `${needed.summaries.length} summaries`);
            for (let i = 0; i < needed.summaries.length; i += 100) {
                const summaries = needed.summaries.slice(i, i + 100);
                const embeddings = await embed(...summaries.map(s => s.content));
                await trpc.embeddings.saveSummaries.mutate(new Map(embeddings?.map((e, i) => ([summaries[i].id, e]))));
                await new Promise(resolve => setTimeout(resolve, 1000));
                updateTask("embeddings", i / needed.summaries.length);
            }
        }

        if (needed.memories.length) {
            console.log(`Generating embeddings for ${needed.memories.length} ${needed.memories.length === 1 ? "memory" : "memories"}`);
            updateTask("embeddings", 0, `${needed.memories.length} memories`);
            for (let i = 0; i < needed.memories.length; i += 100) {
                const memories = needed.memories.slice(i, i + 100);
                const embeddings = await embed(...memories.map(m => `${m.category}: ${m.fact}`));
                await trpc.embeddings.saveMemories.mutate(new Map(embeddings?.map((e, i) => ([memories[i].id, e]))));
                await new Promise(resolve => setTimeout(resolve, 1000));
                updateTask("embeddings", i / needed.memories.length);
            }
        }

        console.log(`All embeddings saved`);
        removeTask("embeddings");
    },
})));

async function embed(...texts: string[]) {
    const config = useSettings.getState().getEmbeddingConfig();
    if (!config) return null;

    const service = useServices.getState().findService(config.service);
    if (!service) return null;

    console.log("Calling embedding model: ", config);
    return await service.embed(texts, config);
}