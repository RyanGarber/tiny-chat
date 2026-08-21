import {
	type BundledLanguage,
	type BundledTheme,
	bundledLanguages,
	bundledLanguagesInfo,
	bundledThemes,
	createHighlighter,
	createJavaScriptRegexEngine,
	type HighlighterGeneric,
	type SpecialLanguage,
	type SpecialTheme,
	type TokensResult,
} from "shiki";
import { flourite } from "../../index.ts";

type CodeLanguage = BundledLanguage;
type CodeTheme = BundledTheme;
type CodeResult = TokensResult;

export type { CodeLanguage, CodeResult, CodeTheme };

const languages = Object.keys(bundledLanguages) as BundledLanguage[];
const languageAliases = Object.fromEntries(
	bundledLanguagesInfo.flatMap((info) =>
		(info.aliases ?? []).map((alias) => [alias, info.id as BundledLanguage]),
	),
);

const themes = Object.keys(bundledThemes) as BundledTheme[];

export const CodeUtils = {
	engine: createJavaScriptRegexEngine({ forgiving: true }),
	languages,
	languageAliases,
	themes,

	highlighters: new Map<
		string,
		Promise<HighlighterGeneric<CodeLanguage, CodeTheme>>
	>(),

	tokens: new Map<string, TokensResult>(),

	subscribers: new Map<string, Set<(result: TokensResult) => void>>(),

	getHighlighter: (
		language: CodeLanguage,
		theme: CodeTheme,
	): Promise<HighlighterGeneric<CodeLanguage, CodeTheme>> => {
		const cacheKey = CodeUtils.getCacheKey(language, theme);

		const cached = CodeUtils.highlighters.get(cacheKey);
		if (cached) return cached;

		const highlighter = createHighlighter({
			themes: [theme, theme],
			langs: [language],
			engine: CodeUtils.engine,
		});

		CodeUtils.highlighters.set(cacheKey, highlighter);
		return highlighter;
	},

	getLanguage: (language: string | null) => {
		if (!language) return null;

		const trimmed = language.trim();
		const lower = trimmed.toLowerCase();
		return (
			languageAliases[lower] ??
			languages.find((name) => name.toLowerCase() === lower) ??
			null
		);
	},

	/**
	 * Guess the language of a snippet. `name` is what the detector called it;
	 * `language` is the Shiki id to highlight as, when we have one.
	 */
	detect: (code: string) => {
		const detected = flourite(code, { shiki: true });
		if (detected.language === "unknown") {
			return { name: null, language: null };
		}
		return {
			name: detected.language,
			language: CodeUtils.getLanguage(detected.language),
		};
	},

	getTheme: (theme: string | null) => {
		if (!theme) return null;

		return (
			themes.find((name) => name.toLowerCase() === theme.toLowerCase()) ?? null
		);
	},

	getCacheKey: (language: string, theme: string, code?: string) => {
		if (code) {
			const start = code.slice(0, 100);
			const end = code.length > 100 ? code.slice(-100) : "";
			return `${language}:${theme}:${code.length}:${start}:${end}`;
		}
		return `${language}:${theme}`;
	},

	/**
	 * Highlights code using Shiki, detecting the language if one is not provided.
	 */
	highlight: (
		{
			code,
			language,
			theme,
		}: {
			code: string;
			language: string | null;
			theme: string | null;
		},
		callback?: (result: TokensResult) => void,
	): TokensResult | null => {
		// resolve language and theme or fall back
		let resolvedLanguage = CodeUtils.getLanguage(language);
		if (!resolvedLanguage) {
			const detected = flourite(code, { shiki: true });
			resolvedLanguage = (
				detected.language !== "unknown"
					? detected.language
					: ("text" satisfies SpecialLanguage)
			) as CodeLanguage;
		}

		let resolvedTheme = CodeUtils.getTheme(theme);
		if (!resolvedTheme) {
			resolvedTheme = "none" satisfies SpecialTheme as CodeTheme;
		}

		// return cached highlighting
		const cacheKey = CodeUtils.getCacheKey(
			resolvedLanguage,
			resolvedTheme,
			code,
		);
		const cached = CodeUtils.tokens.get(cacheKey);
		if (cached) {
			callback?.(cached);
			return cached;
		}

		if (callback) {
			if (!CodeUtils.subscribers.has(cacheKey)) {
				CodeUtils.subscribers.set(cacheKey, new Set());
			}
			CodeUtils.subscribers.get(cacheKey)?.add(callback);
		}

		// run new highlighting
		void (async () => {
			try {
				const highlighter = await CodeUtils.getHighlighter(
					resolvedLanguage,
					resolvedTheme,
				);
				const loadedLanguages = highlighter.getLoadedLanguages();

				console.log(
					`[CodeUtils] using theme: ${resolvedTheme} (${loadedLanguages.length} languages loaded)`,
				);

				const result = highlighter.codeToTokens(code, {
					lang: loadedLanguages.includes(resolvedLanguage)
						? resolvedLanguage
						: "text",
					themes: { dark: resolvedTheme, light: resolvedTheme },
				});

				CodeUtils.tokens.set(cacheKey, result);

				CodeUtils.subscribers.get(cacheKey)?.forEach((subscriber) => {
					subscriber(result);
				});
				CodeUtils.subscribers.delete(cacheKey);
			} catch (error) {
				console.error("[CodeUtils] error highlighting code:", error);
			}
		})();

		return null;
	},

	/**
	 * Extracts a sub-range of tokens from a single-line CodeResult.
	 *
	 * `start` and `end` are character offsets (like `String.slice`). Tokens
	 * that straddle a boundary are split so only the characters inside the
	 * range are included.
	 */
	extractTokenRange: (
		result: CodeResult,
		start: number,
		end: number,
	): CodeResult => {
		const lineTokens = result.tokens[0] ?? [];
		const extracted: (typeof lineTokens)[number][] = [];

		for (const token of lineTokens) {
			const tokenStart = token.offset;
			const tokenEnd = tokenStart + token.content.length;

			if (tokenEnd <= start || tokenStart >= end) continue;

			if (tokenStart >= start && tokenEnd <= end) {
				extracted.push(token);
			} else {
				const sliceStart = Math.max(0, start - tokenStart);
				const sliceEnd = Math.min(token.content.length, end - tokenStart);
				extracted.push({
					...token,
					content: token.content.slice(sliceStart, sliceEnd),
					offset: tokenStart + sliceStart,
				});
			}
		}

		return { ...result, tokens: [extracted] };
	},

	/**
	 * Returns code with no highlighting applied.
	 */
	unhighlight: (code: string): CodeResult => {
		return {
			bg: "transparent",
			fg: "inherit",
			tokens: code.split("\n").map((line) => [
				{
					content: line,
					color: "inherit",
					bgColor: "transparent",
					htmlStyle: {},
					htmlAttrs: {},
					offset: 0,
				},
			]),
		};
	},
} as const;
