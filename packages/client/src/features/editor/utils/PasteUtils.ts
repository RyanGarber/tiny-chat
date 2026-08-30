import { CodeUtils } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";

/** Genuine newline characters a paste may contain before it is collapsed. */
export const PASTE_NEWLINE_LIMIT = 10;

/** Kept as the resulting minimum line count for atom labels and callers. */
export const PASTE_LINE_LIMIT = PASTE_NEWLINE_LIMIT + 1;

const LIST_LINE = /^\s*(?:[-*+]|\d+\.)\s+\S/;

const CODE_LINE =
	/^\s*(?:(?:#!|\/\/|\/\*|\*\/|#include\b)|(?:import|export|from|package|using)\b|(?:async\s+)?(?:function|class|interface|type|enum|def|fn|func)\b|(?:const|let|var|public|private|protected|static|readonly)\b|(?:if|else|for|while|switch|case|try|catch|finally|return|throw|yield)\b|(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b|[}\])]+[,;]?\s*$|<\/?[A-Za-z][^>]*>\s*$|[.#]?[A-Za-z_$][\w$.-]*\s*\{|[A-Za-z_$][\w$.[\]'"-]*\s*(?:=|:=|=>|\+=|-=|\*=|\/=)\s*\S|[A-Za-z_$][\w$.-]*\s*\([^)]*\)\s*(?:[{:;]|=>|$)|[\w.-]+\s*:\s*(?:[[{]|["']|true\b|false\b|null\b|-?\d))/
		.source;

const CODE_LINE_PATTERN = new RegExp(CODE_LINE, "i");
const CODE_PUNCTUATION = /[{};]|=>|:=|::|&&|\|\||===?|!==?|\+\+|--/;
const SQL_STRUCTURE = /\bselect\b[\s\S]*\bfrom\b/i;

/**
 * Pastes that are too long to leave in an input, and pastes that are source
 * rather than prose.
 *
 * A long paste travels as a `:::paste` container so the editor and the
 * renderer can collapse it. A shorter one that still looks like code travels
 * as a fenced block. Everything else is left for the editor to insert as it
 * would any other text.
 */
export const PasteUtils = {
	normalize: (text: string) => text.replace(/\r\n?/g, "\n"),

	lines: (text: string) => PasteUtils.normalize(text).split("\n"),

	isLong: (text: string) =>
		(PasteUtils.normalize(text).match(/\n/g)?.length ?? 0) >=
		PASTE_NEWLINE_LIMIT,

	/**
	 * The body of a fenced block, when the whole paste is one. Null when it is
	 * not fenced, so a paste of source that happens to contain fences is left
	 * alone.
	 */
	unwrapFence: (
		text: string,
	): { language: string | null; text: string } | null => {
		const trimmed = PasteUtils.normalize(text).replace(/^\n+|\n+$/g, "");
		const match = trimmed.match(/^(`{3,}|~{3,})([^\n`]*)\n([\s\S]*)\n\1$/);
		if (!match) return null;

		const language = match[2].trim().split(/\s+/)[0] || null;
		return { language, text: match[3] };
	},

	/**
	 * Language to highlight a paste as, or null when it should not be wrapped
	 * as code. A fenced paste is always code; markdown and bullet lists are
	 * never, so the editor can still parse them.
	 */
	detectCode: (text: string): { language: string | null } | null => {
		const pasted = PasteUtils.normalize(text);
		const trimmed = pasted.trim();
		if (!trimmed) return null;

		const unwrapped = PasteUtils.unwrapFence(trimmed);
		if (unwrapped) {
			return { language: CodeUtils.getLanguage(unwrapped.language) };
		}

		const lines = trimmed.split("\n");
		if (lines.length < 2) return null;

		const nonempty = lines.filter((line) => line.trim());
		if (
			nonempty.length >= 2 &&
			nonempty.every((line) => LIST_LINE.test(line))
		) {
			return null;
		}

		// Flourite is deliberately not part of this decision. It is useful for
		// naming source that we have already identified, but eagerly assigns a
		// language to ordinary prose (for example repeated SQL/C keywords).
		const syntaxLines = nonempty.filter((line) =>
			CODE_LINE_PATTERN.test(line),
		).length;
		const punctuationLines = nonempty.filter((line) =>
			CODE_PUNCTUATION.test(line),
		).length;
		const yamlPairs = nonempty.filter((line) =>
			/^\s*[\w.-]+\s*:\s+\S/.test(line),
		).length;
		const looksLikeCode =
			SQL_STRUCTURE.test(trimmed) ||
			yamlPairs >= 2 ||
			syntaxLines >= Math.max(1, Math.ceil(nonempty.length / 4)) ||
			punctuationLines >= Math.max(2, Math.ceil(nonempty.length / 3));
		if (!looksLikeCode) return null;

		const detected = CodeUtils.detect(trimmed);
		return { language: detected.language };
	},

	/** A fenced block long enough that fences inside the text stay literal. */
	fence: (text: string, language?: string | null) => {
		const pasted = PasteUtils.normalize(text);
		const ticks = Math.max(
			3,
			...[...pasted.matchAll(/^`+/gm)].map((match) => match[0].length + 1),
		);
		const mark = "`".repeat(ticks);
		return `${mark}${language ?? ""}\n${pasted}\n${mark}`;
	},

	/** The Markdown a long paste travels as. */
	markdown: (text: string) => {
		const pasted = PasteUtils.normalize(text);
		const lines = pasted.split("\n");
		const language = PasteUtils.detectCode(pasted)?.language ?? null;
		return `:::paste{lines="${lines.length}"}\n${PasteUtils.fence(pasted, language)}\n:::`;
	},
} as const;
