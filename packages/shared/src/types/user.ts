import { z } from 'zod';
import { zConfig, type Model } from './chat.ts';

export const zCache = z.object({
  providers: z
    .object({
      chat: z
        .array(
          z.object({
            name: z.string(),
            settings: z.array(z.string()),
            models: z.array(z.custom<Model>()),
            error: z.string().optional(),
          }),
        )
        .default([]),
      web: z
        .array(
          z.object({
            name: z.string(),
            settings: z.array(z.string()),
            available: z.boolean(),
            error: z.string().optional(),
          }),
        )
        .default([]),
      other: z
        .array(
          z.object({
            name: z.string(),
            settings: z.array(z.string()),
            available: z.boolean(),
            error: z.string().optional(),
          }),
        )
        .default([]),
    })
    .default({ chat: [], web: [], other: [] }),
});
export type zCache = z.infer<typeof zCache>;

export const zProviderSettings = z.record(z.string(), z.any()).optional();
export type zProviderSettings = z.infer<typeof zProviderSettings>;

export const zMCPServers = z
  .array(
    z.union([
      z.discriminatedUnion('type', [
        z.object({
          name: z.string(),
          type: z.literal('http'),
          url: z.string(),
          auth: z
            .discriminatedUnion('type', [
              z.object({
                type: z.literal('bearer'),
                token: z.string().optional(),
              }),
            ])
            .optional(),
        }),
        z.object({
          name: z.string(),
          type: z.literal('stdio'),
          command: z.array(z.string()),
          env: z.record(z.string(), z.string()).optional(),
        }),
      ]),
    ]),
  )
  .optional();
export type zMCPServers = z.infer<typeof zMCPServers>;

export const zHiddenModel = zConfig.pick({ model: true, provider: true });
export type zHiddenModel = z.infer<typeof zHiddenModel>;

export const zHiddenModels = z
  .object({
    generate: z.array(zHiddenModel).default([]),
    embed: z.array(zHiddenModel).default([]),
  })
  .default({ generate: [], embed: [] });
export type zHiddenModels = z.infer<typeof zHiddenModels>;

export const zSettings = z
  .object({
    instructions: z.array(z.string()),
    embeddingConfig: zConfig,
    useEmbeddingSearch: z.boolean(),
    preferredWebProvider: z.string(),
    hiddenModels: zHiddenModels,
    useProviderCache: z.boolean(),
    theme: z.string(),
    codeTheme: z.string(),
    providers: zProviderSettings,
    mcpServers: zMCPServers.catch(() => undefined),
  })
  .partial();
export type zSettings = z.infer<typeof zSettings>;

export const zUser = z.object({
  id: z.string(),
  settings: zSettings,
});
export type zUser = z.infer<typeof zUser>;
