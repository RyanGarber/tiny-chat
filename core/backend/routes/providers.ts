import {z} from "zod";
import {procedure, router} from "../index.ts";
import {chatProviders} from "../providers/chat/index.ts";
import {type ChatProviderStatus, type SearchProviderStatus, zConfig} from "../types.ts";
import {type Session} from "../server.ts";
import {getEmbeddingConfig} from "./embeddings.ts";
import {searchProviders} from "../providers/search/index.ts";

export default router({
    getChatModels: procedure
        .input(z.object({service: z.string()}))
        .query(async ({ctx, input}) => {
            const provider = chatProviders.find(s => s.name === input.service);
            if (!provider) throw new Error(`Chat provider "${input.service}" not found`);
            return provider.getModels(ctx.session);
        }),

    listProviders: procedure.query(async ({ctx}) => {
        const chat: ChatProviderStatus[] = [];

        for (const provider of chatProviders) {
            try {
                const models = await provider.getModels(ctx.session);
                chat.push({
                    name: provider.name,
                    settings: provider.settings,
                    models: models
                });
            } catch (e) {
                console.error(`Failed to fetch models from ${provider.name}:`, e);
                chat.push({
                    name: provider.name,
                    settings: provider.settings,
                    models: [],
                });
            }
        }

        const search: SearchProviderStatus[] = [];

        search.push(...searchProviders.map(provider => ({name: provider.name, settings: provider.settings})));

        return {chat, search};
    }),

    embed: procedure
        .input(z.object({texts: z.array(z.string()), config: zConfig}))
        .mutation(async ({ctx, input}) => {
            return embed(ctx.session, input.texts);
        }),
});

export async function embed(session: Session, texts: string[]) {
    const config = getEmbeddingConfig(session);
    if (!config) return [];

    const service = chatProviders.find(s => s.name === config.service);
    if (!service) return [];

    return service.embed(session, texts, config);
}