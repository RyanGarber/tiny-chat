import { ThemeUtils } from "#core/core/utils/ThemeUtils.ts";
import { TypeUtils } from "#core/core/utils/TypeUtils.ts";
import { zSettings } from "#core/features/data/types/user.ts";

type zSettingsWithDefaults = Required<zSettings>;

export const SettingsUtils = {
	of: (
		user?: { settings?: zSettings | null } | null,
		context?: { settings?: zSettings | null } | null,
	): zSettingsWithDefaults => {
		return SettingsUtils.defaults(
			SettingsUtils.merge({
				to: user?.settings ?? {},
				from: context?.settings ?? null,
			}),
		);
	},

	/**
	 * The primary folder: the project's first folder, else the user's first.
	 */
	primaryFolder: (
		user?: { settings?: zSettings | null } | null,
		project?: { settings?: zSettings | null } | null,
	): string | null =>
		project?.settings?.folders?.[0]?.path ??
		user?.settings?.folders?.[0]?.path ??
		null,

	/**
	 * Merges settings with the context's entries last.
	 */
	merge: ({
		to,
		from,
	}: {
		to: zSettings;
		from?: zSettings | null;
	}): zSettings => {
		const merged = TypeUtils.deepClone(to);
		if (from) {
			const overrides = TypeUtils.deepClone(from);
			for (const key of zSettings.keyof().options) {
				if (overrides[key] === undefined) continue;
				if (Array.isArray(merged[key]) && Array.isArray(overrides[key])) {
					Object.assign(merged, { [key]: [...merged[key], ...overrides[key]] });
				} else if (
					merged[key] !== null &&
					typeof merged[key] === "object" &&
					typeof overrides[key] === "object"
				) {
					Object.assign(merged[key], overrides[key]);
				} else {
					Object.assign(merged, { [key]: overrides[key] });
				}
			}
		}
		return merged;
	},

	defaults: (from?: zSettings | null): zSettingsWithDefaults => {
		const codeThemes = [
			...ThemeUtils.codeThemesByTheme[from?.theme ?? ThemeUtils.themes[0]],
		];
		return {
			...from,
			theme: from?.theme ?? ThemeUtils.themes[0],
			codeTheme:
				from?.codeTheme && codeThemes.includes(from.codeTheme)
					? from.codeTheme
					: codeThemes[0],
			instructions: from?.instructions ?? [],
			commands: from?.commands ?? [],
			folders: from?.folders ?? [],
			memoryBudget: from?.memoryBudget ?? 2500,
			embeddingConfig: from?.embeddingConfig ?? null,
			dreamConfig: from?.dreamConfig ?? null,
			presets: from?.presets ?? {},
			providers: from?.providers ?? {},
			preferredWebProvider: from?.preferredWebProvider ?? null,
			mcpServers: from?.mcpServers ?? {},
			hiddenModels: {
				language: from?.hiddenModels?.language ?? [],
				embedding: from?.hiddenModels?.embedding,
			},
			subagentConfig: from?.subagentConfig ?? null,
			useBrowserModels: from?.useBrowserModels ?? false,
			useEmbeddingSearch: from?.useEmbeddingSearch ?? false,
			useProviderCache: from?.useProviderCache ?? false,
		};
	},
} as const;
