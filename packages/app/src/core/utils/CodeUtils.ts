import {
	createCodePlugin,
	type HighlightResult,
	code as StreamdownCode,
} from "@streamdown/code";
import flourite from "flourite";
import type { BundledLanguage, BundledTheme } from "streamdown";

export const CodeUtils = {
	/**
	 * Streamdown Code with language detection.
	 */
	plugin: (theme: BundledTheme): ReturnType<typeof createCodePlugin> => {
		return {
			...createCodePlugin({
				themes: [theme, theme],
			}),
			supportsLanguage: () => {
				return true;
			},
			highlight: ({ language, code }, callback): HighlightResult | null => {
				return CodeUtils.highlight(language, theme, code, callback);
			},
		};
	},

	/**
	 * Highlights code using Streamdown Code, detecting the language if one is not provided.
	 */
	highlight: (
		language: string | null,
		codeTheme: string | null,
		code: string,
		callback?: (result: HighlightResult) => void,
	): HighlightResult => {
		if (
			!language ||
			!StreamdownCode.supportsLanguage(language as BundledLanguage)
		) {
			const detected = flourite(code, { shiki: true });
			if (detected.language !== "unknown") {
				language = detected.language;
			}
		}

		const highlight = !!codeTheme && !!language;
		const highlightResult = highlight
			? StreamdownCode.highlight(
					{
						code,
						language: language as BundledLanguage,
						themes: [codeTheme as BundledTheme, codeTheme as BundledTheme],
					},
					callback,
				)
			: null;

		const result = highlightResult ?? CodeUtils.unhighlight(code);
		if (!highlight || highlightResult) callback?.(result);
		return result;
	},

	/**
	 * Returns code with no highlighting applied.
	 */
	unhighlight: (code: string): HighlightResult => {
		return {
			bg: "transparent",
			fg: "inherit",
			tokens: code.split("\n").map((line) => [
				{
					content: line,
					color: "inherit",
					bgColor: "transparent",
					htmlStyle: {},
					offset: 0,
				},
			]),
		};
	},
} as const;
