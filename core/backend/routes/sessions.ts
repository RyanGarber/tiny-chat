import {procedure, router} from "../index.ts";
import {createId} from "@paralleldrive/cuid2";
import {z} from "zod";

type Clone = {
    id: string;
    userId: string | null;
}
const clones: Clone[] = [];

export default router({
    startClone: procedure.mutation(async ({ctx}) => {
        const id = createId();
        clones.push({id, userId: null});
        console.log(`Clone ${id} started by ${ctx.session.user.id}`);
        return id;
    }),
    acceptClone: procedure.input(z.object({id: z.cuid2()})).mutation(async ({ctx, input}) => {
        const clone = clones.find(c => c.id === input.id);
        if (!clone) throw new Error('Clone not found');
        clone.userId = ctx.session.user.id;
        console.log(`Clone ${input.id} accepted by ${ctx.session.user.id}`);
    }),
    finalizeClone: procedure.input(z.object({id: z.cuid2()})).query(async ({ctx, input}) => {
        const clone = clones.find(c => c.id === input.id);
        if (!clone) throw new Error('Clone not found');
        if (!clone.userId) return false;
        console.log(`Clone ${input.id} finalized, ${ctx.session.user.id} is now ${clone.userId}`);
        clones.splice(clones.indexOf(clone), 1);
        await ctx.prisma.session.update({
            where: {id: ctx.session.session.id},
            data: {user: {connect: {id: clone.userId}}}
        });
        return true;
    })
})