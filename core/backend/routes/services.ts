import {z} from "zod";
import {procedure, router} from "../index.ts";
import {services} from "../services/index.ts";
import {type Service, zConfig} from "../types.ts";
import {type Session} from "../server.ts";
import {getEmbeddingConfig} from "./embeddings.ts";

export default router({
    getModels: procedure
        .input(z.object({service: z.string()}))
        .query(async ({ctx, input}) => {
            const service = services.find(s => s.name === input.service);
            if (!service) throw new Error(`Service "${input.service}" not found`);
            return service.getModels(ctx.session);
        }),

    listServices: procedure.query(async ({ctx}) => {
        const available: Service[] = [];

        for (const service of services) {
            try {
                const models = await service.getModels(ctx.session);
                available.push({
                    name: service.name,
                    settings: service.settings,
                    models: models
                });
            } catch (e) {
                console.error(`Failed to fetch models from ${service.name}:`, e);
                available.push({
                    name: service.name,
                    settings: service.settings,
                    models: [],
                });
            }
        }

        return available;
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

    const service = services.find(s => s.name === config.service);
    if (!service) return [];

    return service.embed(session, texts, config);
}