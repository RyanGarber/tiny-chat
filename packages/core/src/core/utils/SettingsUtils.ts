import { zSettings } from "../../features/data/types/user.ts";
import { ThemeUtils } from "./ThemeUtils.ts";
import { TypeUtils } from "./TypeUtils.ts";

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
				if (key === "commandWhitelist") {
					merged.commandWhitelist = [
						...new Set([
							...(merged.commandWhitelist ?? []),
							...(overrides.commandWhitelist ?? []),
						]),
					];
				} else if (key === "folders") {
					// The override's paths come first so its first path is the working
					// directory, and its `writable` wins for a path listed in both.
					const paths = new Set(overrides.folders?.map(({ path }) => path));
					merged.folders = [
						...(overrides.folders ?? []),
						...(merged.folders ?? []).filter(({ path }) => !paths.has(path)),
					];
				} else if (
					Array.isArray(merged[key]) &&
					Array.isArray(overrides[key])
				) {
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
			commandWhitelist: from?.commandWhitelist ?? [],
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
