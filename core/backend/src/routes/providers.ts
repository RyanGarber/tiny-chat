import { z } from 'zod';
import { procedure, router } from '../index.ts';
import { chatProviders } from '../providers/chat/index.ts';
import {
  type ChatProviderStatus,
  type OtherProviderStatus,
  type WebProviderStatus,
  zConfig,
} from '../types.ts';
import { webProviders } from '../providers/web/index.ts';
import { otherProviders } from '../providers/other/index.ts';
import { checkProvider } from '../providers/base.ts';
import { embed } from '../utils/embed.ts';

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

    const web: WebProviderStatus[] = await Promise.all(
      webProviders.map((p) => checkProvider(p, ctx.session.user)),
    );

    const other: OtherProviderStatus[] = await Promise.all(
      otherProviders.map((p) => checkProvider(p, ctx.session.user)),
    );

    return { chat, web, other };
  }),

  embed: procedure
    .input(z.object({ texts: z.array(z.string()), config: zConfig }))
    .mutation(async ({ ctx, input }) => {
      return embed(ctx.session.user, input.texts);
    }),
});
