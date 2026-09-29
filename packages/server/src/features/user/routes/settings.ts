import { ThemeUtils } from "@tiny-chat/core/core/utils/ThemeUtils.ts";
import { ProjectLike } from "@tiny-chat/core/features/data/types/chat.ts";
import { zConfig } from "@tiny-chat/core/features/data/types/message.ts";
import {
	zFolderPath,
	zMCPServers,
	zSettings,
} from "@tiny-chat/core/features/data/types/user.ts";
import { z } from "zod";
import { procedure, router } from "../../../index.ts";
import { SettingsService } from "../services/SettingsService.ts";

export const settings = router({
	get: procedure
		.input(
			z
				.object({
					project: ProjectLike.nullish(),
				})
				.default({}),
		)
		.query(async ({ ctx, input }) => {
			return await SettingsService.getSettings({
				user: ctx.session.user,
				project: input.project,
			});
		}),

	getRaw: procedure
		.input(
			z
				.object({
					project: ProjectLike.nullish(),
				})
				.default({}),
		)
		.query(async ({ ctx, input }): Promise<Record<string, unknown>> => {
			return (await SettingsService.getSettingsRaw({
				user: ctx.session.user,
				project: input.project,
			})) as Record<string, unknown>;
		}),

	setTheme: procedure
		.input(
			z.object({
				theme: z.enum(ThemeUtils.themes),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					theme: input.theme,
				}),
			});
		}),

	setCodeTheme: procedure
		.input(
			z.object({
				codeTheme: z.enum(ThemeUtils.codeThemes),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					instructions:
						settings.instructions?.map((v, i) =>
							i === input.index ? input.instruction : v,
						) ?? [],
				}),
			});
		}),

	addCommand: procedure
		.input(
			z.object({
				command: z.string().trim().min(1),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					commandWhitelist: [
						...new Set([...(settings.commandWhitelist ?? []), input.command]),
					],
				}),
			});
		}),

	removeCommand: procedure
		.input(
			z.object({
				index: z.number(),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					commandWhitelist:
						settings.commandWhitelist?.filter((_, i) => i !== input.index) ??
						[],
				}),
			});
		}),

	editCommand: procedure
		.input(
			z.object({
				index: z.number(),
				command: z.string().trim().min(1),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					commandWhitelist: [
						...new Set(
							settings.commandWhitelist?.map((v, i) =>
								i === input.index ? input.command : v,
							) ?? [],
						),
					],
				}),
			});
		}),

	addFolder: procedure
		.input(
			z.object({
				path: zFolderPath.shape.path,
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					folders: [
						...(settings.folders ?? []).filter(
							({ path }) => path !== input.path,
						),
						{ path: input.path, writable: false },
					],
				}),
			});
		}),

	removeFolder: procedure
		.input(
			z.object({
				index: z.number(),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					folders: settings.folders?.filter((_, i) => i !== input.index) ?? [],
				}),
			});
		}),

	setFolderWritable: procedure
		.input(
			z.object({
				index: z.number(),
				writable: z.boolean(),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					folders:
						settings.folders?.map((v, i) =>
							i === input.index ? { ...v, writable: input.writable } : v,
						) ?? [],
				}),
			});
		}),

	setMemoryBudget: procedure
		.input(
			z.object({
				tokens: z.number(),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					preferredWebProvider: input.preferredWebProvider,
				}),
			});
		}),

	setEmbeddingConfig: procedure
		.input(
			z.object({ config: zConfig.nullish(), project: ProjectLike.nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					useEmbeddingSearch: input.useEmbeddingSearch,
				}),
			});
		}),

	setDreamConfig: procedure
		.input(
			z.object({ config: zConfig.nullish(), project: ProjectLike.nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					dreamConfig: input.config ?? undefined,
				}),
			});
		}),

	setSubagentConfig: procedure
		.input(
			z.object({ config: zConfig.nullish(), project: ProjectLike.nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
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
			z.object({
				useProviderCache: z.boolean(),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					useProviderCache: input.useProviderCache,
				}),
			});
		}),

	setUseBrowserModels: procedure
		.input(
			z.object({
				useBrowserModels: z.boolean(),
				project: ProjectLike.nullish(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					useBrowserModels: input.useBrowserModels,
				}),
			});
		}),

	setMcpServers: procedure
		.input(
			z.object({ mcpServers: zMCPServers, project: ProjectLike.nullish() }),
		)
		.mutation(async ({ ctx, input }) => {
			return SettingsService.setSettings({
				user: ctx.session.user,
				project: input.project,
				update: (settings) => ({
					...settings,
					mcpServers: input.mcpServers,
				}),
			});
		}),
});
