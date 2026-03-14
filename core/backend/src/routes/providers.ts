import { z } from 'zod';
import { procedure, router } from '../index.ts';
import { chatProviders } from '../providers/chat/index.ts';
import { type ChatProviderStatus, type SearchProviderStatus, zConfig } from '../types.ts';
import { searchProviders } from '../providers/search/index.ts';
import { embed } from '../embed.ts';

export default router({
  list: procedure.query(async ({ ctx }) => {
    const chat: ChatProviderStatus[] = [];

    for (const provider of chatProviders) {
      try {
        const models = await provider.getModels(ctx.session.user);
        chat.push({
          name: provider.name,
          settings: provider.settings,
          models: models,
        });
      } catch (e) {
        console.error(`Failed to fetch models from ${provider.name}:`, e);
        chat.push({
          name: provider.name,
          settings: provider.settings,
          models: [],
          error: (e as Error).message ?? (e as Error).name ?? 'Unknown',
        });
      }
    }

    const search: SearchProviderStatus[] = [];

    for (const provider of searchProviders) {
      try {
        search.push({
          name: provider.name,
          settings: provider.settings,
          available: await provider.check(ctx.session.user),
        });
      } catch (e) {
        console.error(`Failed to test search provider ${provider.name}:`, e);
        search.push({
          name: provider.name,
          settings: provider.settings,
          available: false,
          error: (e as Error).message ?? (e as Error).name ?? 'Unknown',
        });
      }
    }

    return { chat, search };
  }),

  embed: procedure
    .input(z.object({ texts: z.array(z.string()), config: zConfig }))
    .mutation(async ({ ctx, input }) => {
      return embed(ctx.session.user, input.texts);
    }),
});
