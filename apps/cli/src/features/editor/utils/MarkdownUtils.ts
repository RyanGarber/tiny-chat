import type { ColorScheme } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import type { TLabels, TStyles } from "react-ink-textarea";

/**
 * Markdown as it is being written, drawn the way the message it becomes is
 * drawn.
 *
 * The text area paints text by pattern rather than by tree, so the markdown is
 * matched where it stands instead of parsed: every construct is one or more
 * rules, and the rules are read in order with the first one to claim a
 * character keeping it. That ordering is what stands in for nesting — a fenced
 * block is claimed before anything else, so nothing inside one is read as
 * markdown, and a marker is claimed before the span around it, so the syntax
 * stays visible under a style of its own.
 */

/** The labels the markdown is painted under, each with a style below. */
const LABEL = {
	code: "markdownCode",
	codeFence: "markdownCodeFence",
	inlineCode: "markdownInlineCode",
	heading: "markdownHeading",
	headingMarker: "markdownHeadingMarker",
	quote: "markdownQuote",
	quoteMarker: "markdownQuoteMarker",
	bullet: "markdownBullet",
	task: "markdownTask",
	rule: "markdownRule",
	bold: "markdownBold",
	italic: "markdownItalic",
	strike: "markdownStrike",
	linkText: "markdownLinkText",
	linkUrl: "markdownLinkUrl",
} as const;

/** Characters that carry a meaning of their own inside a pattern. */
const ESCAPED = /[\\^$.*+?()[\]{}|]/g;

const escaped = (text: string) => text.replace(ESCAPED, "\\$&");

/**
 * The rules for an inline span held between two markers, as the marker itself
 * and then the span around it.
 *
 * The span is never empty, never opened or closed on a space, and never
 * carried past the end of its line — which is what keeps a lone marker, or one
 * standing in prose, from styling the rest of the editor.
 *
 * @param boundary Whether the marker only counts between words, for `_`, which
 * turns up inside them and marks nothing there.
 */
const inline = ({
	marker,
	label,
	boundary = false,
}: {
	marker: string;
	label: string;
	boundary?: boolean;
}): TLabels => {
	const delimiter = escaped(marker);
	// Safe inside a character class as it stands, where an escape would not be.
	const char = marker[0];

	const inner = `(?![\\s${char}])(?:[^\\n]*?[^\\s${char}])?`;
	const before = boundary ? "(?<![\\p{L}\\p{N}])" : "";
	const after = boundary ? "(?![\\p{L}\\p{N}])" : "";

	return [
		{
			pattern: new RegExp(
				`${before}${delimiter}(?=${inner}${delimiter}${after})`,
				"gu",
			),
			label: `${label}Marker`,
		},
		{
			pattern: new RegExp(
				`(?<=${before}${delimiter}${inner})${delimiter}${after}`,
				"gu",
			),
			label: `${label}Marker`,
		},
		{
			pattern: new RegExp(`${before}${delimiter}${inner}${delimiter}`, "gu"),
			label,
		},
	];
};

/** The markers a construct that spans a whole line opens with. */
const HEADING = /^ {0,3}#{1,6}(?=[ \t])/gm;
const QUOTE = /^[ \t]*>[ \t>]*/gm;
const BULLET = /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?=[ \t])/gm;
const TASK = /(?<=^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)\[[ xX]\]/gm;
const RULE = /^ {0,3}(?:[-*_][ \t]*){3,}$/gm;

/**
 * The prefix a list item or a quote carries, which the line after it keeps:
 * the indentation and any quote markers, the bullet or the number, and the
 * checkbox of a task.
 */
const PREFIX =
	/^([ \t]*(?:>[ \t]*)*)((?:[-*+]|\d{1,9}[.)])[ \t]+)?(\[[ xX]\][ \t]+)?/;

/** A fence opened on the line, up to the cursor. */
const FENCE_OPEN = /^ {0,3}`{3,}[^`\n]*$/;

/** The fence closing it, from the cursor to the end of the line. */
const FENCE_CLOSE = /^`{3,}[ \t]*$/;

/** Markers that are closed as they are opened. */
const MARKERS = ["*", "_", "`", "~"];

/** A write the editor makes in place of the one that was typed. */
export type MarkdownWrite = { content: string; offset: number };

export const MarkdownUtils = {
	/**
	 * Rules that paint the markdown, for the text area's `labels`.
	 *
	 * Read in order: the fenced blocks and the inline code first, which claim
	 * their contents whole; then the line markers; then the inline spans; and
	 * last the lines that are styled through to their end, which are left until
	 * the markup inside them has been claimed.
	 */
	labels: (): TLabels => [
		{ pattern: /^ {0,3}`{3,}[^\n]*$/gm, label: LABEL.codeFence },
		{
			pattern:
				/^ {0,3}`{3,}[^\n]*\n[\s\S]*?(?:^ {0,3}`{3,}[^\n]*$|(?![\s\S]))/gm,
			label: LABEL.code,
		},
		...inline({ marker: "`", label: LABEL.inlineCode }),

		{ pattern: HEADING, label: LABEL.headingMarker },
		{ pattern: QUOTE, label: LABEL.quoteMarker },
		// Before the bullet, so that a line of dashes is a rule rather than an
		// item, and before the emphasis, so that one of asterisks is too.
		{ pattern: RULE, label: LABEL.rule },
		{ pattern: BULLET, label: LABEL.bullet },
		{ pattern: TASK, label: LABEL.task },

		// Before the italic, whose marker is the first half of this one.
		...inline({ marker: "**", label: LABEL.bold }),
		...inline({ marker: "~~", label: LABEL.strike }),
		...inline({ marker: "*", label: LABEL.italic }),
		...inline({ marker: "_", label: LABEL.italic, boundary: true }),

		{ pattern: /\[[^\n\]]*\](?=\([^\n)]*\))/g, label: LABEL.linkText },
		{ pattern: /(?<=\[[^\n\]]*\])\([^\n)]*\)/g, label: LABEL.linkUrl },

		{ pattern: /^ {0,3}#{1,6}[ \t][^\n]*/gm, label: LABEL.heading },
		{ pattern: /^[ \t]*>[^\n]*/gm, label: LABEL.quote },
	],

	/**
	 * How each of those labels is drawn, for the text area's `styles`.
	 *
	 * A marker is set apart by its colour rather than by `dim`, which the
	 * terminal turns off with the same code it turns bold off with — dimming the
	 * markers of a bold span would take the bold off the span itself.
	 */
	styles: (colorScheme: ColorScheme): TStyles => ({
		[LABEL.codeFence]: { color: colorScheme.textSubtle },
		[LABEL.code]: {
			color: colorScheme.textSubtle,
			bgColor: colorScheme.interior,
		},
		[`${LABEL.inlineCode}Marker`]: {
			color: colorScheme.textSubtle,
			bgColor: colorScheme.interior,
		},
		[LABEL.inlineCode]: {
			color: colorScheme.text,
			bgColor: colorScheme.interior,
		},

		[LABEL.headingMarker]: { color: colorScheme.primary, bold: true },
		[LABEL.heading]: { bold: true },
		[LABEL.quoteMarker]: { color: colorScheme.primary },
		[LABEL.quote]: { color: colorScheme.textSubtle, italic: true },
		[LABEL.bullet]: { color: colorScheme.primary, bold: true },
		[LABEL.task]: { color: colorScheme.primary },
		[LABEL.rule]: { color: colorScheme.textSubtle },

		[`${LABEL.bold}Marker`]: { color: colorScheme.textSubtle, bold: true },
		[LABEL.bold]: { bold: true },
		[`${LABEL.italic}Marker`]: { color: colorScheme.textSubtle, italic: true },
		[LABEL.italic]: { italic: true },
		[`${LABEL.strike}Marker`]: {
			color: colorScheme.textSubtle,
			strikethrough: true,
		},
		[LABEL.strike]: { strikethrough: true },

		[LABEL.linkText]: { color: colorScheme.primary, underline: true },
		[LABEL.linkUrl]: { color: colorScheme.textSubtle },
	}),

	/**
	 * The write a typed marker makes in place of writing itself, so that a span
	 * is closed as it is opened. Null when the marker is written as it was
	 * typed.
	 *
	 * A marker typed against one already standing steps over it instead of
	 * doubling it — unless it is standing at the opening, where a second one
	 * turns an italic into a bold rather than closing it.
	 *
	 * @param value The content as it stood before the marker was typed.
	 * @param offset Where the cursor was when it was.
	 */
	marked: ({
		value,
		offset,
		marker,
	}: {
		value: string;
		offset: number;
		marker: string;
	}): MarkdownWrite | null => {
		if (!MARKERS.includes(marker)) return null;

		let start = offset;
		while (start > 0 && value[start - 1] === marker) start -= 1;

		let end = offset;
		while (end < value.length && value[end] === marker) end += 1;

		const before = value[start - 1];
		const after = value[end];

		// A marker run that nothing precedes is the opening of a span rather than
		// the closing of one, however many markers have been typed into it.
		const isOpening = before === undefined || /[\s([{<"']/.test(before);

		// The span is being closed by hand, on the marker already closing it.
		if (end > offset && !isOpening)
			return { content: value, offset: offset + 1 };

		// Marking a word up from its left, where the closing marker belongs at the
		// far end of it rather than against the cursor — so the one that was typed
		// is written as it was.
		if (after !== undefined && /[\p{L}\p{N}]/u.test(after)) return null;

		return {
			content: `${value.slice(0, offset)}${marker}${marker}${value.slice(offset)}`,
			offset: offset + 1,
		};
	},

	/**
	 * The write a newline makes in place of writing itself, so that the block
	 * the cursor is in carries on: a list keeps its bullet or its next number, a
	 * quote keeps its marker, and a fence opened and closed on the one line is
	 * broken open with the cursor between the two of them.
	 *
	 * An item or a quote that is still empty is ended instead, its marker taken
	 * back off. Null when the newline is written as it was typed.
	 */
	broken: ({
		value,
		offset,
	}: {
		value: string;
		offset: number;
	}): MarkdownWrite | null => {
		const start = value.lastIndexOf("\n", offset - 1) + 1;
		const found = value.indexOf("\n", offset);
		const end = found === -1 ? value.length : found;

		if (
			FENCE_OPEN.test(value.slice(start, offset)) &&
			FENCE_CLOSE.test(value.slice(offset, end))
		)
			return {
				content: `${value.slice(0, offset)}\n\n${value.slice(offset)}`,
				offset: offset + 1,
			};

		const line = value.slice(start, end);
		const match = line.match(PREFIX);
		if (!match) return null;

		const [prefix, quote, marker = "", task = ""] = match;
		if (!quote.includes(">") && !marker) return null;

		// Nothing was written into the item or the quote, so the block ends here
		// rather than opening another one: the marker is taken back off and the
		// cursor left on the line it stood on.
		if (!line.slice(prefix.length).trim())
			return {
				content: `${value.slice(0, start)}${value.slice(end)}`,
				offset: start,
			};

		const next = `${quote}${marker.replace(/^\d{1,9}/, (digits) => String(Number(digits) + 1))}${task ? "[ ] " : ""}`;

		return {
			content: `${value.slice(0, offset)}\n${next}${value.slice(offset)}`,
			offset: offset + 1 + next.length,
		};
	},
} as const;
