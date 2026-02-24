import {z} from "zod";
import {procedure, router} from "../index.ts";
import {createId} from "@paralleldrive/cuid2";
import {reorder} from "./messages.ts";
import {zConfig, zData, type zDataType, zMetadata} from "../types.ts";
import minisearch, {type SearchResult} from "minisearch";

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
        .input(z.object({id: z.cuid2(), untilMessageId: z.cuid2(), title: z.string()}))
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
                await ctx.prisma.folder.update({
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
                    title: input.title,
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

    search: procedure
        .input(z.object({query: z.string().min(1)}))
        .query(async ({ctx, input}) => {
            const messages = await ctx.prisma.message.findMany({
                where: {userId: ctx.session.user.id, chat: {temporary: {equals: false}}},
                include: {chat: {select: {title: true}}, folder: {select: {title: true}}},
            });
            const search = new minisearch({
                fields: ["folderTitle", "chatTitle", "text"],
                storeFields: ["id", "chatId", "data", "folderTitle", "chatTitle"],
                searchOptions: {
                    boost: {
                        chatTitle: 2
                    },
                    fuzzy: 0.2,
                    prefix: true
                }
            });
            search.addAll(messages.map((message) => ({
                id: message.id,
                chatId: message.chatId,
                data: zData.parse(message.data),
                folderTitle: message.folder.title,
                chatTitle: message.chat.title,
                // TODO - adding && !p.hidden makes typescript think it's no longer text????????
                text: zData.parse(message.data).filter(p => p.type === "text").map(t => t.value).join("\n"),
            })))
            return search.search(input.query) as (SearchResult & {
                id: string,
                chatId: string,
                data: zDataType,
                folderTitle: string,
                chatTitle: string,
            })[];
        })
});