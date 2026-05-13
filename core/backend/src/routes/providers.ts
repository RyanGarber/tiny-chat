import { z } from 'zod';
import { procedure, router } from '../index.ts';
import { chatProviders } from '../providers/chat/index.ts';
import { zCache, zConfig } from '../types.ts';
import { webProviders } from '../providers/web/index.ts';
import { otherProviders } from '../providers/other/index.ts';
import { checkProvider } from '../providers/base.ts';
import { embed } from '../utils/embed.ts';
import type { User } from '../server.ts';

export default router({
  list: procedure.input(z.object({ update: z.boolean() })).query(async ({ ctx, input }) => {
    return listProviders(ctx.session.user, input.update);
  }),

  embed: procedure
    .input(z.object({ texts: z.array(z.string()), config: zConfig }))
    .mutation(async ({ ctx, input }) => {
      return embed(ctx.session.user, input.texts);
    }),
});

export async function listProviders(user: User, update: boolean) {
  const cache: zCache = zCache.parse(
    (
      await prisma.user.findFirst({
        select: { cache: true },
        where: { id: user.id },
      })
    )?.cache ?? {},
  );

  if (update) {
    cache.providers.chat = [];
    for (const provider of chatProviders) {
      try {
        const models = await provider.getModels(user);
        cache.providers.chat.push({
          name: provider.name,
          settings: provider.settings,
          models: models,
        });
      } catch (e) {
        console.error(`Failed to fetch models from ${provider.name}:`, e);
        cache.providers.chat.push({
          name: provider.name,
          settings: provider.settings,
          models: [],
          error: (e as Error).message ?? (e as Error).name ?? 'Unknown',
        });
      }
    }

    cache.providers.web = await Promise.all(webProviders.map((p) => checkProvider(p, user)));

    cache.providers.other = await Promise.all(otherProviders.map((p) => checkProvider(p, user)));

    console.log('Updating providers in cache');
    await globalThis.prisma.user.update({
      where: { id: user.id },
      data: { cache: cache as any },
    });
  }

  return cache.providers;
}
