import { z } from 'zod';
import { procedure, router } from '../index.ts';

export default router({
  list: procedure.query(async ({ ctx }) => {
    return globalThis.prisma.upload.findMany({
      where: { userId: ctx.session.user.id },
      include: { files: true },
    });
  }),

  delete: procedure.input(z.object({ id: z.cuid2() })).mutation(async ({ ctx, input }) => {
    await globalThis.prisma.upload.delete({
      where: { id: input.id, userId: ctx.session.user.id },
    });
  }),
});
