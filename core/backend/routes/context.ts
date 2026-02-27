import {z} from "zod";
import {createId} from "@paralleldrive/cuid2";
import {procedure, router} from "../index.ts";
import {MemoryCategory, MemoryStability} from "../generated/prisma/enums.ts";
import {zConfig} from "../types.ts";
import {getMostRelevant, SearchOptions} from "./embeddings.ts";
import {type Memory} from "../generated/prisma/client.ts";

export default router({
    createMemories: procedure.input(z.object({
        chatId: z.cuid2(),
        config: zConfig,
        memories: z.array(z.object({
            fact: z.string(),
            category: z.enum(MemoryCategory),
            stability: z.enum(MemoryStability),
            evidence: z.array(z.string()),
            confidence: z.number().min(0).max(1),
        }))
    })).mutation(async ({ctx, input}) => {
        const chat = await ctx.prisma.chat.findUniqueOrThrow({
            where: {id: input.chatId, userId: ctx.session.user.id},
            include: {messages: true}
        });
        await ctx.prisma.$transaction(async tx => {
            await tx.memory.updateMany({where: {chatId: input.chatId}, data: {latest: false}});
            for (const memory of input.memories) {
                await tx.memory.create({
                    data: {
                        id: createId(),
                        user: {connect: {id: chat.userId}},
                        folder: {connect: {id: chat.folderId}},
                        chat: {connect: {id: chat.id}},
                        config: input.config,
                        messages: {connect: chat.messages.map(m => ({id: m.id}))},
                        fact: memory.fact,
                        category: memory.category,
                        stability: memory.stability,
                        evidence: memory.evidence,
                        confidence: memory.confidence
                    }
                });
            }
        });
    }),

    createSummary: procedure.input(z.object({
        chatId: z.cuid2(),
        config: zConfig,
        content: z.string()
    })).mutation(async ({ctx, input}) => {
        const chat = await ctx.prisma.chat.findUniqueOrThrow({
            where: {id: input.chatId, userId: ctx.session.user.id},
            include: {messages: true},
        });
        await ctx.prisma.summary.create({
            data: {
                id: createId(),
                user: {connect: {id: chat.userId}},
                folder: {connect: {id: chat.folderId}},
                chat: {connect: {id: chat.id}},
                config: input.config,
                messages: {connect: chat.messages.map(m => ({id: m.id}))},
                content: input.content,
            }
        });
    }),

    listUpdatedChats: procedure.query(async ({ctx}) => {
        const chats = await ctx.prisma.chat.findMany({
            where: {user: {id: ctx.session.user.id}, temporary: false},
            select: {
                id: true,
                messages: {select: {createdAt: true}, orderBy: {createdAt: "desc"}, take: 1},
                memories: {select: {createdAt: true}, orderBy: {createdAt: "desc"}, take: 1}, // TODO - could return only new message IDs since last memory
            },
        });
        return chats.filter(c => c.messages[0]?.createdAt > (c.memories[0]?.createdAt ?? new Date(0)))
    }),

    listRelevantMemories: procedure.input(z.object({
        embedding: z.array(z.number()),
        options: SearchOptions.optional()
    })).mutation(async ({ctx, input}) => {
        return getMostRelevant(input.embedding, (await ctx.prisma.$queryRaw<(Memory & {
            embedding: string
        })[]>`SELECT *
              FROM memory
              WHERE "userId" = ${ctx.session.user.id}`).map(m => ({
            value: m as Memory,
            embedding: JSON.parse(m.embedding)
        })), input.options).map(m => m.value as Memory);
    })
})