import { procedure, router } from '../index.ts';
import { z } from 'zod';

export default router({
  list: procedure.input(z.object({ chatId: z.cuid2() })).query(async ({ ctx, input }) => {
    return globalThis.prisma.action.findMany({
      where: { chatId: input.chatId, userId: ctx.session.user.id },
    });
  }),
});
