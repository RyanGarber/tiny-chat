import { CodeUtils } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";

/** Lines a paste may run to before it is collapsed into a `:::paste` block. */
export const PASTE_LINE_LIMIT = 10;

const LIST_LINE = /^\s*(?:[-*+]|\d+\.)\s+\S/;

const CODE_TOKEN =
	/[{}();]|=>|:=|::|\b(?:function|const|let|var|def|fn|func|class|import|export|return|public|private|package|using|select|from|where)\b|#!\//;

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

	isLong: (text: string) => PasteUtils.lines(text).length >= PASTE_LINE_LIMIT,

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
		if (lines.length < 5) return null;

		const nonempty = lines.filter((line) => line.trim());
		if (
			nonempty.length >= 2 &&
			nonempty.every((line) => LIST_LINE.test(line))
		) {
			return null;
		}

		const detected = CodeUtils.detect(trimmed);
		if (detected.name === "markdown" || detected.name === "md") return null;

		const hasToken = CODE_TOKEN.test(trimmed);
		const indented = lines.some((line) => /^\s+\S/.test(line));

		if (lines.length === 1) {
			if (!hasToken) return null;
			return { language: detected.language };
		}

		if (detected.name === "yaml" && !hasToken && !indented) {
			const pairs = nonempty.filter((line) => /^[\w.-]+\s*:\s+\S/.test(line));
			if (pairs.length >= 2) return { language: "yaml" };
			return null;
		}

		if (hasToken || indented || (detected.name && detected.name !== "yaml")) {
			return { language: detected.language };
		}

		if (detected.name === "yaml" && indented) return { language: "yaml" };

		return null;
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
