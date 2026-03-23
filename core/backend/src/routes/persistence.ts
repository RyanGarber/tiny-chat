import { z } from 'zod';
import { procedure, router } from '../index.ts';

export default router({
  listMemories: procedure.query(async ({ ctx }) => {
    return globalThis.prisma.memory.findMany({
      where: { userId: ctx.session.user.id },
    });
  }),

  listActions: procedure.query(async ({ ctx }) => {
    return globalThis.prisma.action.findMany({
      where: { userId: ctx.session.user.id },
    });
  }),

  listUploads: procedure.query(async ({ ctx }) => {
    return globalThis.prisma.upload.findMany({
      where: { userId: ctx.session.user.id },
    });
  }),

  deleteUpload: procedure.input(z.object({ id: z.cuid2() })).mutation(async ({ ctx, input }) => {
    await globalThis.prisma.upload.delete({
      where: { id: input.id, userId: ctx.session.user.id },
    });
  }),
});
