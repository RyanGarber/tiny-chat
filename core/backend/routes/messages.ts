import {z} from "zod";
import {createId} from "@paralleldrive/cuid2";
import {procedure, router} from "../index.ts";
import {createForChat} from "./folders.ts";
import {Author, type Message as PrismaMessage} from "../generated/prisma/client.ts";
import {type MessageCreateInput} from "../generated/prisma/models.ts";
import {type MessageOmission, wrapMessage, zConfig, zData, zMetadata} from "../types.ts";

export default router({
    create: procedure
        .input(
            z.object({
                chatId: z.cuid2().optional(),
                author: z.enum(Author),
                config: zConfig,
                data: zData,
                metadata: zMetadata,
                previousId: z.cuid2().optional(),
                temporary: z.boolean().optional(),
            }),
        )
        .mutation(async ({ctx, input}) => {
            return wrapMessage(await ctx.prisma.$transaction(async (tx) => {
                const self: Partial<MessageCreateInput> = {
                    id: createId(),
                    user: {connect: {id: ctx.session.user.id}},
                    author: input.author,
                    config: input.config,
                    data: input.data,
                    metadata: input.metadata,
                    previous: input.previousId
                        ? {connect: {id: input.previousId}}
                        : undefined,
                };

                if (input.chatId) {
                    let chat = await tx.chat.findUniqueOrThrow({
                        where: {id: input.chatId, userId: ctx.session.user.id},
                    });

                    if (input.temporary && !chat.temporary) throw new Error("Chat cannot be made temporary");

                    if (input.previousId) {
                        await tx.message.updateMany({
                            where: {previousId: input.previousId},
                            data: {previousId: null},
                        });
                    } else {
                        const lastMessage = await tx.message.findFirstOrThrow({
                            where: {chatId: chat.id, next: null},
                        });
                        (self as any).previous = {connect: {id: lastMessage.id}};
                    }

                    (self as any).folder = {connect: {id: chat.folderId}};
                    (self as any).chat = {connect: {id: chat.id}};
                    const message = await tx.message.create({data: self as MessageCreateInput});

                    if (input.previousId) {
                        await tx.message.updateMany({
                            where: {
                                AND: [
                                    {previousId: input.previousId},
                                    {NOT: {id: self.id}},
                                ],
                            },
                            data: {previousId: message.id},
                        });
                    }

                    return message;
                } else {
                    return (await createForChat(ctx.prisma, ctx.session.user.id, input.temporary ?? false, self as MessageCreateInput))
                        .chats[0].messages[0];
                }
            }));
        }),

    edit: procedure
        .input(
            z.object({
                id: z.cuid2(),
                author: z.enum(Author),
                config: zConfig,
                data: zData,
                metadata: zMetadata,
                truncate: z.boolean(),
            }),
        )
        .mutation(async ({ctx, input}) => {
            console.log(`Editing message ${input.id} (truncate: ${input.truncate})`);
            if (input.truncate) {
                console.log(`Truncating messages after ${input.id}`);
                await ctx.prisma.message.deleteMany({
                    where: {previousId: input.id, userId: ctx.session.user.id},
                });
            }
            return wrapMessage(await ctx.prisma.message.update({
                where: {id: input.id, userId: ctx.session.user.id},
                data: {
                    author: input.author,
                    config: input.config,
                    data: input.data,
                    metadata: input.metadata,
                    createdAt: new Date(),
                },
            }));
        }),

    delete: procedure
        .input(z.object({id: z.cuid2()}))
        .mutation(async ({ctx, input}) => {
            const message = await ctx.prisma.message.findUniqueOrThrow({
                where: {id: input.id, userId: ctx.session.user.id},
                include: {
                    previous: true,
                    next: true,
                    folder: {include: {chats: true, messages: true}},
                    chat: {include: {messages: true}},
                },
            });

            let where = {OR: [{id: message.id}]};
            if (message.author === Author.USER && message.next)
                where.OR.push({id: message.next.id});
            else if (message.author === Author.MODEL && message.previous)
                where.OR.push({id: message.previous.id});

            if (message.folder.messages.length <= 2)
                await ctx.prisma.folder.delete({where: {id: message.folderId}});
            else if (message.chat.messages.length <= 2)
                await ctx.prisma.chat.delete({where: {id: message.chatId}});
            else await ctx.prisma.message.deleteMany({where});
        }),

    list: procedure
        .input(z.object({chatId: z.cuid2()}))
        .query(async ({ctx, input}) => {
            return reorder((await ctx.prisma.message.findMany({
                where: {chatId: input.chatId, userId: ctx.session.user.id},
                omit: {metadata: true}
            })).map(m => ({...m, metadata: {_omit: true}}))).map(wrapMessage);
        }),

    listOmissions: procedure
        .input(z.object({ids: z.array(z.cuid2())}))
        .query(async ({ctx, input}): Promise<Map<string, MessageOmission>> => {
            return new Map((await ctx.prisma.message.findMany({
                where: {id: {in: input.ids}, userId: ctx.session.user.id},
                select: {id: true, metadata: true}
            })).map(m => [m.id, {metadata: m.metadata}]));
        })
});

export function reorder(messages: PrismaMessage[]) {
    if (messages.length <= 1) return messages;

    const firstMessage = messages.find(m => m.previousId === null);
    if (!firstMessage) return messages;

    const sorted = [firstMessage];

    let currentId = firstMessage.id;
    while (sorted.length < messages.length) {
        const nextMessage = messages.find(m => m.previousId === currentId);
        if (!nextMessage) break;
        sorted.push(nextMessage);
        currentId = nextMessage.id;
    }

    return sorted;
}