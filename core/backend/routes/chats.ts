import {z} from "zod";
import {procedure, router} from "../index.ts";
import {createId} from "@paralleldrive/cuid2";
import {reorder} from "./messages.ts";
import {zConfig, zData, zMetadata} from "../types.ts";

export default router({
    find: procedure
        .input(z.object({id: z.cuid2().nullable()}))
        .query(async ({ctx, input}) => {
            if (!input.id) return null;
            return ctx.prisma.chat.findUnique({
                where: {id: input.id, userId: ctx.session.user.id},
            });
        }),

    edit: procedure
        .input(z.object({id: z.cuid2(), title: z.string()}))
        .mutation(async ({ctx, input}) => {
            const chat = await ctx.prisma.chat.findUniqueOrThrow({
                where: {id: input.id, userId: ctx.session.user.id},
                select: {title: true, folder: {select: {id: true, title: true}}},
            });
            await ctx.prisma.chat.update({
                where: {id: input.id},
                data: {
                    title: input.title,
                    ...(chat.folder.title === chat.title
                        ? {folder: {update: {title: input.title}}}
                        : {}),
                },
            });
        }),

    clone: procedure
        .input(z.object({id: z.cuid2(), untilMessageId: z.cuid2()}))
        .mutation(async ({ctx, input}) => {
            const chat = await ctx.prisma.chat.findUniqueOrThrow({
                where: {id: input.id, userId: ctx.session.user.id},
                include: {folder: {include: {chats: true}}}
            });
            let messages = reorder(await ctx.prisma.message.findMany({
                where: {chatId: input.id},
            }));

            let reachedMessage = false;
            messages = messages.filter((message) => {
                if (message.id === input.untilMessageId) {
                    reachedMessage = true;
                    return true;
                } else {
                    return !reachedMessage;
                }
            });

            messages.forEach((message) => {
                const id = createId();
                const next = messages.find((m) => m.previousId === message.id);
                if (next) next.previousId = id;
                message.id = id;
                delete (message as any).chatId;
            });

            if (chat.folder.chats.length === 1) {
                await ctx.prisma.chat.update({
                    where: {id: chat.folderId},
                    data: {
                        title: chat.title,
                    },
                });
            }

            return ctx.prisma.chat.create({
                data: {
                    id: createId(),
                    user: {connect: {id: chat.userId}},
                    folder: {connect: {id: chat.folderId}},
                    messages: {
                        createMany: {
                            data: messages.map((message) => ({
                                ...message,
                                config: zConfig.parse(message.config),
                                data: zData.parse(message.data),
                                metadata: zMetadata.parse(message.metadata),
                            })),
                        },
                    },
                },
            });
        }),

    delete: procedure
        .input(z.object({id: z.cuid2()}))
        .mutation(async ({ctx, input}) => {
            const chat = await ctx.prisma.chat.findUniqueOrThrow({
                where: {id: input.id, userId: ctx.session.user.id},
                include: {folder: {include: {chats: true}}},
            });
            if (chat.folder.chats.length === 1) await ctx.prisma.folder.delete({where: {id: chat.folderId}});
            else await ctx.prisma.chat.delete({where: {id: input.id}});
        }),
});
