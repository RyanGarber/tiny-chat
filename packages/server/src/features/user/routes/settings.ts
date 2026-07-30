import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import {
	zHiddenModel,
	zMCPServers,
} from "@tiny-chat/core/src/features/data/types/user.ts";
import { zModelFeature } from "@tiny-chat/core/src/features/provider/types/model.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { SettingsService } from "../services/SettingsService.ts";

export const settings = router({
	get: procedure.query(async ({ ctx }) => {
		return await SettingsService.getSettings({
			user: ctx.session.user,
		});
	}),

	getUnparsed: procedure.query(async ({ ctx }) => {
		const user = await globalThis.prisma.user.findUniqueOrThrow({
			where: { id: ctx.session.user.id },
			select: { settings: true },
		});
		return user.settings ?? {};
	}),

	setTheme: procedure
		.input(z.object({ theme: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({ ...settings, theme: input.theme }),
			});
		}),

	setCodeTheme: procedure
		.input(z.object({ codeTheme: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					codeTheme: input.codeTheme,
				}),
			});
		}),

	setBlackout: procedure
		.input(z.object({ blackout: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					blackout: input.blackout,
				}),
			});
		}),

	addInstruction: procedure
		.input(z.object({ instruction: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					instructions: [...(settings.instructions ?? []), input.instruction],
				}),
			});
		}),

	removeInstruction: procedure
		.input(z.object({ index: z.number() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					instructions:
						settings.instructions?.filter((_, i) => i !== input.index) ?? [],
				}),
			});
		}),

	editInstruction: procedure
		.input(z.object({ index: z.number(), instruction: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					instructions:
						settings.instructions?.map((v, i) =>
							i === input.index ? input.instruction : v,
						) ?? [],
				}),
			});
		}),

	setPreset: procedure
		.input(
			z.object({ name: z.string().regex(/[A-Za-z0-9-_]+/), config: zConfig }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					presets: {
						...settings.presets,
						[input.name]: input.config,
					},
				}),
			});
		}),

	unsetPreset: procedure
		.input(z.object({ name: z.string().regex(/[A-Za-z0-9-_]+/) }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => {
					const newPresets = { ...settings.presets };
					delete newPresets[input.name];
					return {
						...settings,
						presets: newPresets,
					};
				},
			});
		}),

	setHiddenModels: procedure
		.input(
			z.object({
				feature: zModelFeature,
				models: z.array(zHiddenModel),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => {
					settings.hiddenModels ??= { language: [], embedding: [] };
					settings.hiddenModels[input.feature] = input.models;
					return settings;
				},
			});
		}),

	setPreferredWebProvider: procedure
		.input(z.object({ preferredWebProvider: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					preferredWebProvider: input.preferredWebProvider,
				}),
			});
		}),

	setEmbeddingConfig: procedure
		.input(z.object({ config: zConfig.nullish() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					embeddingConfig: input.config
						? ({
								model: input.config.model,
								provider: input.config.provider,
							} satisfies Partial<zConfig> as zConfig)
						: undefined,
				}),
			});
		}),

	setUseEmbeddingSearch: procedure
		.input(z.object({ useEmbeddingSearch: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					useEmbeddingSearch: input.useEmbeddingSearch,
				}),
			});
		}),

	setProviderSetting: procedure
		.input(
			z.object({
				provider: z.string(),
				key: z.string(),
				value: z.string().nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					providers: {
						...settings.providers,
						[input.provider]: {
							...settings.providers?.[input.provider],
							[input.key]: input.value ?? undefined,
						},
					},
				}),
			});
		}),

	setUseProviderCache: procedure
		.input(z.object({ useProviderCache: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					useProviderCache: input.useProviderCache,
				}),
			});
		}),

	setUseBrowserModels: procedure
		.input(z.object({ useBrowserModels: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					useBrowserModels: input.useBrowserModels,
				}),
			});
		}),

	setMcpServers: procedure
		.input(z.object({ mcpServers: zMCPServers }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				update: (settings) => ({
					...settings,
					mcpServers: input.mcpServers,
				}),
			});
		}),
});
