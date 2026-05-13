import { zMCPServers, zSettings } from '@tiny-chat/shared/src/types/user.ts';
import { procedure, router } from '../index.ts';
import z from 'zod';
import { zConfig } from '@tiny-chat/shared/src/types/chat.ts';
import type { tRPCContext } from '../services/api.ts';
import { auth, authHeaders } from '../services/auth.ts';

export default router({
  get: procedure.query(async ({ ctx }) => {
    const user = await globalThis.prisma.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: { settings: true },
    });
    return zSettings.parse(user.settings ?? {});
  }),

  setTheme: procedure.input(z.object({ theme: z.string() })).mutation(async ({ ctx, input }) => {
    return set(ctx, (settings) => ({ ...settings, theme: input.theme }));
  }),

  setCodeTheme: procedure
    .input(z.object({ codeTheme: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({ ...settings, codeTheme: input.codeTheme }));
    }),

  addInstruction: procedure
    .input(z.object({ instruction: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({
        ...settings,
        instructions: [...(settings.instructions ?? []), input.instruction],
      }));
    }),

  removeInstruction: procedure
    .input(z.object({ index: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({
        ...settings,
        instructions: settings.instructions?.filter((_, i) => i !== input.index) ?? [],
      }));
    }),

  editInstruction: procedure
    .input(z.object({ index: z.number(), instruction: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({
        ...settings,
        instructions:
          settings.instructions?.map((v, i) => (i === input.index ? input.instruction : v)) ?? [],
      }));
    }),

  setPreferredModels: procedure
    .input(z.object({ feature: z.enum(['generate', 'embed']), models: z.array(zConfig) }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => {
        settings.preferredModels ??= { generate: [], embed: [] };
        settings.preferredModels[input.feature] = input.models.map(
          (m) => ({ model: m.model, provider: m.provider }) satisfies Partial<zConfig> as zConfig,
        );
        return settings;
      });
    }),

  setPreferredWebProvider: procedure
    .input(z.object({ preferredWebProvider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({
        ...settings,
        preferredWebProvider: input.preferredWebProvider,
      }));
    }),

  setEmbeddingConfig: procedure
    .input(z.object({ config: zConfig.nullish() }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({
        ...settings,
        embeddingConfig: input.config
          ? ({
              model: input.config.model,
              provider: input.config.provider,
            } satisfies Partial<zConfig> as zConfig)
          : undefined,
      }));
    }),

  setUseEmbeddingSearch: procedure
    .input(z.object({ useEmbeddingSearch: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({
        ...settings,
        useEmbeddingSearch: input.useEmbeddingSearch,
      }));
    }),

  setMcpServers: procedure
    .input(z.object({ mcpServers: zMCPServers }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({ ...settings, mcpServers: input.mcpServers }));
    }),

  setProviderSetting: procedure
    .input(z.object({ provider: z.string(), key: z.string(), value: z.string().nullish() }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({
        ...settings,
        providers: {
          ...settings.providers,
          [input.provider]: {
            ...settings.providers?.[input.provider],
            [input.key]: input.value ?? undefined,
          },
        },
      }));
    }),

  setUseProviderCache: procedure
    .input(z.object({ useProviderCache: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return set(ctx, (settings) => ({
        ...settings,
        useProviderCache: input.useProviderCache,
      }));
    }),

  listAccounts: procedure.query(async ({ ctx }) => {
    return auth.api.listUserAccounts({ headers: authHeaders(ctx.req.headers) });
  }),
});

async function set(ctx: tRPCContext, update: (old: zSettings) => zSettings) {
  let settings = zSettings.parse(ctx.session.user.settings ?? {});
  settings = update(settings);
  await globalThis.prisma.user.update({ where: { id: ctx.session.user.id }, data: { settings } });
  return zSettings.parse(settings);
}
