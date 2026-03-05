import {z} from "zod";
import {procedure, router} from "../index.ts";
import {services} from "../services/index.ts";
import {type Service, zConfig} from "../types.ts";

export default router({
    getModels: procedure
        .input(z.object({service: z.string()}))
        .query(async ({ctx, input}) => {
            const service = services.find(s => s.name === input.service);
            if (!service) throw new Error(`Service "${input.service}" not found`);
            const settings = ctx.session.user.settings?.services?.[service.name] ?? {};
            return service.getModels(settings);
        }),

    listServices: procedure.query(async ({ctx}) => {
        const available: Service[] = [];

        // TODO - make settings object custom per service (e.g., 'projectId')
        for (const service of services) {
            try {
                const settings = ctx.session.user.settings?.services?.[service.name] ?? {};
                const models = await service.getModels(settings);
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
            const service = services.find(s => s.name === input.config.service);
            if (!service) return [];
            const settings = ctx.session.user.settings?.services?.[service.name] ?? {};
            return service.embed(settings, input.texts, input.config);
        }),
});
