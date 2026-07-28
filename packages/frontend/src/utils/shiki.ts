import { type HighlightResult, code as StreamdownCode } from "@streamdown/code";
import flourite from "flourite";
import type { BundledLanguage, BundledTheme } from "streamdown";

const highlightCache: Record<string, HighlightResult> = {};

const unhighlight = (code: string): HighlightResult => {
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
};

/**
 * Highlights `code` using Streamdown's Shiki-backed highlighter.
 */
export const highlight = (
	language: string | null,
	codeTheme: string | null,
	code: string,
	onReady?: (result: HighlightResult) => void,
): HighlightResult => {
	if (!codeTheme) {
		const result = unhighlight(code);
		onReady?.(result);
		return result;
	}

	if (
		!language ||
		!StreamdownCode.supportsLanguage(language as BundledLanguage)
	) {
		const detected = flourite(code, { shiki: true });
		return highlight(
			detected.language === "unknown" ? "json" : detected.language,
			codeTheme,
			code,
			onReady,
		);
	}

	const cacheKey = `${language}-${codeTheme}-${code.trim()}`;
	const cached = highlightCache[cacheKey];
	if (cached) {
		onReady?.(cached);
		return cached;
	}

	const result = StreamdownCode.highlight(
		{
			code,
			language: language as BundledLanguage,
			themes: [codeTheme as BundledTheme, codeTheme as BundledTheme],
		},
		(asyncResult) => {
			// Only cache the genuine result - never the placeholder below, or
			// this key would be stuck returning unhighlighted code forever.
			highlightCache[cacheKey] = asyncResult;
			onReady?.(asyncResult);
		},
	);

	if (!result) return unhighlight(code);

	highlightCache[cacheKey] = result;
	onReady?.(result);
	return result;
};
