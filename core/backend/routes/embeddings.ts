import {z} from "zod";
import {procedure, router} from "../index.ts";
import type {Memory, Message, Summary} from "../generated/prisma/client.ts";
import {wrapMessage} from "../types.ts";

const TX_TIMEOUT = 10000; // might not be needed

export default router({
    listMissingEmbeddings: procedure.query(async ({ctx}) => {
        return {
            messages: (await ctx.prisma.$queryRaw<Message[]>`SELECT *
                                                             FROM message
                                                             WHERE "userId" = ${ctx.session.user.id}
                                                               AND embedding IS NULL
                                                               AND NOT EXISTS (SELECT 1 FROM chat WHERE chat.id = "chatId" AND chat.temporary = true)`).map(wrapMessage)
            , summaries: (await ctx.prisma.$queryRaw<Summary[]>`SELECT *
                                                                FROM summary
                                                                WHERE "userId" = ${ctx.session.user.id}
                                                                  AND embedding IS NULL`)
            , memories: (await ctx.prisma.$queryRaw<Memory[]>`SELECT *
                                                              FROM memory
                                                              WHERE "userId" = ${ctx.session.user.id}
                                                                AND embedding IS NULL`)
        };
    }),

    saveMessages: procedure.input(z.map(z.cuid2(), z.array(z.number()))).mutation(async ({input, ctx}) => {
        await ctx.prisma.$transaction(async (tx) => {
            for (const [messageId, values] of input) {
                await tx.$executeRaw`UPDATE message
                                     SET embedding = ${`[${values.join(',')}]`}::vector
                                     WHERE id = ${messageId}
                                       AND "userId" = ${ctx.session.user.id}`;
            }
        }, {timeout: TX_TIMEOUT});
    }),

    saveSummaries: procedure.input(z.map(z.cuid2(), z.array(z.number()))).mutation(async ({input, ctx}) => {
        await ctx.prisma.$transaction(async (tx) => {
            for (const [summaryId, values] of input) {
                await tx.$executeRaw`UPDATE summary
                                     SET embedding = ${`[${values.join(',')}]`}::vector
                                     WHERE id = ${summaryId}
                                       AND "userId" = ${ctx.session.user.id}`;
            }
        }, {timeout: TX_TIMEOUT});
    }),

    saveMemories: procedure.input(z.map(z.cuid2(), z.array(z.number()))).mutation(async ({input, ctx}) => {
        await ctx.prisma.$transaction(async (tx) => {
            for (const [memoryId, values] of input) {
                await tx.$executeRaw`UPDATE memory
                                     SET embedding = ${`[${values.join(',')}]`}::vector
                                     WHERE id = ${memoryId}
                                       AND "userId" = ${ctx.session.user.id}`;
            }
        }, {timeout: TX_TIMEOUT});
    }),

    resetAll: procedure.mutation(async ({ctx}) => {
        await ctx.prisma.$transaction(async (tx) => {
            await tx.$executeRaw`UPDATE message
                                 SET embedding = NULL
                                 WHERE "userId" = ${ctx.session.user.id}`;
            await tx.$executeRaw`UPDATE summary
                                 SET embedding = NULL
                                 WHERE "userId" = ${ctx.session.user.id}`;
            await tx.$executeRaw`UPDATE memory
                                 SET embedding = NULL
                                 WHERE "userId" = ${ctx.session.user.id}`;
        })
    })
});

export function getCosineSimilarity(a: number[], b: number[]) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const SearchOptions = z.object({
    maxCount: z.number().optional(),
    minCount: z.number().optional(),
    diversityWeight: z.number().optional()
});

export function getMostRelevant(
    subjectEmbedding: number[],
    candidates: { value: any; embedding: number[] }[],
    options: z.infer<typeof SearchOptions> = {}
) {
    if (!candidates.length) return [];

    const {maxCount = 10, minCount = 1, diversityWeight = 0.3} = options;

    const scoredCandidates = candidates.map(c => ({
        ...c,
        score: getCosineSimilarity(subjectEmbedding, c.embedding),
    }));

    const mean = scoredCandidates.reduce((s, c) => s + c.score, 0) / scoredCandidates.length;
    const variance = scoredCandidates.reduce((s, c) => s + (c.score - mean) ** 2, 0) / scoredCandidates.length;
    const standardDeviation = Math.sqrt(variance);

    const threshold = mean + (standardDeviation / 2);

    let bestCandidates = scoredCandidates
        .filter(c => c.score >= threshold)
        .sort((a, b) => b.score - a.score);

    if (bestCandidates.length < minCount) { // fallback
        bestCandidates = scoredCandidates.sort((a, b) => b.score - a.score).slice(0, minCount);
    }

    const finalCandidates: (typeof scoredCandidates[number])[] = [];

    while (finalCandidates.length < maxCount && bestCandidates.length) {
        let bestIndex = 0;
        let bestScore = -Infinity;

        for (let i = 0; i < bestCandidates.length; i++) {
            const score = bestCandidates[i].score;

            const redundancy = finalCandidates.length
                ? Math.max(...finalCandidates.map(s => getCosineSimilarity(bestCandidates[i].embedding, s.embedding)))
                : 0;

            const mmrScore = ((1 - diversityWeight) * score) - (diversityWeight * redundancy);

            if (mmrScore > bestScore) {
                bestScore = mmrScore;
                bestIndex = i;
            }
        }

        finalCandidates.push(bestCandidates.splice(bestIndex, 1)[0]);
    }

    return finalCandidates;
}