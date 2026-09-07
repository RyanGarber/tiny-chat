import { ThemeUtils } from "@tiny-chat/core/src/core/utils/ThemeUtils.ts";
import { FolderLike } from "@tiny-chat/core/src/features/data/types/chat.ts";
import { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import {
	zMCPServers,
	zSettings,
} from "@tiny-chat/core/src/features/data/types/user.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { SettingsService } from "../services/SettingsService.ts";

export const settings = router({
	get: procedure
		.input(
			z
				.object({
					folder: FolderLike.nullish(),
				})
				.default({}),
		)
		.query(async ({ ctx, input }) => {
			return await SettingsService.getSettings({
				user: ctx.session.user,
				folder: input.folder,
			});
		}),

	getRaw: procedure
		.input(
			z
				.object({
					folder: FolderLike.nullish(),
				})
				.default({}),
		)
		.query(async ({ ctx, input }) => {
			return await SettingsService.getSettingsRaw({
				user: ctx.session.user,
				folder: input.folder,
			});
		}),

	setTheme: procedure
		.input(
			z.object({
				theme: z.enum(ThemeUtils.themes),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					theme: input.theme,
					codeTheme:
						settings.codeTheme &&
						ThemeUtils.codeThemesByTheme(input.theme).includes(
							settings.codeTheme,
						)
							? settings.codeTheme
							: undefined,
				}),
			});
		}),

	setCodeTheme: procedure
		.input(
			z.object({
				codeTheme: z.enum(ThemeUtils.codeThemes),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					codeTheme: input.codeTheme,
				}),
			});
		}),

	addInstruction: procedure
		.input(
			z.object({
				instruction: z.string(),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					instructions: [...(settings.instructions ?? []), input.instruction],
				}),
			});
		}),

	removeInstruction: procedure
		.input(
			z.object({
				index: z.number(),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					instructions:
						settings.instructions?.filter((_, i) => i !== input.index) ?? [],
				}),
			});
		}),

	editInstruction: procedure
		.input(
			z.object({
				index: z.number(),
				instruction: z.string(),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					instructions:
						settings.instructions?.map((v, i) =>
							i === input.index ? input.instruction : v,
						) ?? [],
				}),
			});
		}),

	setMemoryBudget: procedure
		.input(
			z.object({
				tokens: z.number(),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					memoryBudget: input.tokens,
				}),
			});
		}),

	setPreset: procedure
		.input(
			z.object({
				name: z.string().regex(/[A-Za-z0-9-_]+/),
				config: zConfig,
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
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
		.input(
			z.object({
				name: z.string().regex(/[A-Za-z0-9-_]+/),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
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
				feature: zSettings.shape.hiddenModels.unwrap().keyType,
				models: zSettings.shape.hiddenModels.unwrap().valueType,
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => {
					settings.hiddenModels ??= { language: [], embedding: [] };
					settings.hiddenModels[input.feature] = input.models;
					return settings;
				},
			});
		}),

	setPreferredWebProvider: procedure
		.input(
			z.object({
				preferredWebProvider: z.string(),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					preferredWebProvider: input.preferredWebProvider,
				}),
			});
		}),

	setEmbeddingConfig: procedure
		.input(
			z.object({ config: zConfig.nullish(), folder: FolderLike.nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					embeddingConfig: input.config ?? undefined,
				}),
			});
		}),

	setUseEmbeddingSearch: procedure
		.input(
			z.object({
				useEmbeddingSearch: z.boolean(),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					useEmbeddingSearch: input.useEmbeddingSearch,
				}),
			});
		}),

	setDreamConfig: procedure
		.input(
			z.object({ config: zConfig.nullish(), folder: FolderLike.nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					dreamConfig: input.config ?? undefined,
				}),
			});
		}),

	setSubagentConfig: procedure
		.input(
			z.object({ config: zConfig.nullish(), folder: FolderLike.nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					subagentConfig: input.config ?? undefined,
				}),
			});
		}),

	setProviderSetting: procedure
		.input(
			z.object({
				provider: z.string(),
				key: z.string(),
				value: z.string().nullish(),
				folder: FolderLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
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
		.input(
			z.object({ useProviderCache: z.boolean(), folder: FolderLike.nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					useProviderCache: input.useProviderCache,
				}),
			});
		}),

	setUseBrowserModels: procedure
		.input(
			z.object({ useBrowserModels: z.boolean(), folder: FolderLike.nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					useBrowserModels: input.useBrowserModels,
				}),
			});
		}),

	setMcpServers: procedure
		.input(z.object({ mcpServers: zMCPServers, folder: FolderLike.nullish() }))
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				folder: input.folder,
				update: (settings) => ({
					...settings,
					mcpServers: input.mcpServers,
				}),
			});
		}),
});
