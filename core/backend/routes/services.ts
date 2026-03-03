import {z} from "zod";
import {procedure, router} from "../index.ts";
import {services} from "../services/index.ts";
import {Author} from "../generated/prisma/enums.ts";
import {type MessageUnomitted, type Service, zConfig, zData} from "../types.ts";

const Context = z.array(z.object({id: z.cuid2().optional(), author: z.enum(Author), data: zData}));
type Context = z.infer<typeof Context>;

export default router({
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

    generate: procedure
        .input(z.object({
            instruction: z.string(),
            context: Context,
            config: zConfig,
        }))
        .mutation(async function* ({ctx, input, signal}) {
            const service = services.find(s => s.name === input.config.service);
            if (!service) return;

            const settings = ctx.session.user.settings?.services?.[service.name] ?? {};

            const abortController = new AbortController();
            signal?.addEventListener("abort", () => abortController.abort());

            const context: MessageUnomitted[] = [];
            const messageDatas = await ctx.prisma.message.findMany({
                where: {
                    id: {
                        in: (input.context as Context).flatMap(m => m.id ? [m.id] : [])
                    }
                }
            });

            for (const message of input.context as Context) {
                if (message.id) {
                    context.push(messageDatas.find(m => m.id === message.id) as MessageUnomitted);
                } else {
                    context.push(message as MessageUnomitted);
                }
            }

            console.log("Calling model for user with context length:", context.length);

            const stream = service.generate(
                settings,
                input.instruction,
                context,
                input.config,
                abortController.signal
            );

            for await (const event of stream) {
                yield event;
            }
        }),
});
