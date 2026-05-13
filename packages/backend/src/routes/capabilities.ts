import { zToolContext, type zToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import backend from '../tools/index.ts';
import { z } from 'zod';
import { procedure, router } from '../index.ts';

export default router({
  listTools: procedure.query((): zToolGroup[] => {
    return backend;
  }),

  callTool: procedure
    .input(
      z.object({
        context: zToolContext,
        name: z.string(),
        input: z.any(),
        userInput: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await globalThis.prisma.chat.findUniqueOrThrow({
        where: { id: input.context.chat?.id, userId: ctx.session.user.id },
      });
      const tool = backend.flatMap((g) => g.tools).find((t) => t.name === input.name);
      if (!tool) throw new Error(`Tool not found: ${input.name}`);
      console.log(`Running tool ${input.name} with params ${JSON.stringify(input.input)}`);
      return tool.run(input.context, input.input, input.userInput) as Promise<z.ZodAny>;
    }),

  listSkills: procedure
    .input(z.object({ withResources: z.boolean().optional() }))
    .query(({ ctx, input }) => {
      return globalThis.prisma.skill.findMany({
        where: { userId: ctx.session.user.id },
        include: { files: input.withResources ? true : { where: { path: { has: 'SKILL.md' } } } },
      });
    }),

  listSkillFiles: procedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return (
      await globalThis.prisma.skill.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.session.user.id },
        include: { files: true },
      })
    ).files;
  }),
});
