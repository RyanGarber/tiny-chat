import type { TLabels } from "react-ink-textarea";
import stringWidth from "string-width";

/**
 * Geometry of the text area, mirrored outside of it.
 *
 * `react-ink-textarea` wraps long lines into visual rows and scrolls them under
 * a viewport, but keeps that layout to itself: the only positions it hands out
 * are `[line, column]` pairs. Turning a click into one of those means laying the
 * value out the same way it does, so these functions follow its `textUtils` and
 * `useViewport` closely enough to land on the same row.
 */

export type EditorCursor = [line: number, column: number];

/** A selected range, from where it was started to where it was dragged. */
export type EditorSelection = [anchor: number, focus: number];

/** The label the selected text is painted under. */
export const SELECTION_LABEL = "selection";

/** The labels the two kinds of token are painted under. */
export const COMMAND_LABEL = "command";
export const ATTACHMENT_LABEL = "attachment";

/** A command or an attachment, which is only ever handled whole. */
export type EditorToken = {
	start: number;
	end: number;
	label: typeof COMMAND_LABEL | typeof ATTACHMENT_LABEL;
};

export type EditorRow = {
	/** Index of the logical line the row is part of. */
	line: number;
	/** Column of that line the row starts at. */
	column: number;
	text: string;
	/** Padding row rendered under the value to hold the editor's minimum height. */
	isVirtual: boolean;
};

/** Matches the text area's default, which the editor does not override. */
const TAB_WIDTH = 4;

const SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Characters that carry a meaning of their own inside a pattern. */
const ESCAPED = /[\\^$.*+?()[\]{}|]/g;

// Commands and attachments are written into the value as inline directives,
// by `CommandUtils.toDirective` and `AttachmentUtils.apply`.
const TOKEN_REGEX = /:(command|attachment)\[[^\]\n]*\]\{[^}\n]*\}/g;

/** The kinds of run a selection taken a word at a time takes whole. */
type EditorWord = "word" | "symbol" | "space";

/**
 * Which run a character belongs to. A newline belongs to none of them, so a run
 * never carries across a line.
 */
const wordKind = (char: string | undefined): EditorWord | null => {
	if (char === undefined || char === "\n") return null;
	if (/\s/.test(char)) return "space";
	return /[\p{L}\p{N}_]/u.test(char) ? "word" : "symbol";
};

/** Columns a single grapheme takes up once the terminal draws it. */
const graphemeWidth = (grapheme: string, tabWidth: number) => {
	if (grapheme.length === 0) return 0;
	if (grapheme === "\t") return Math.max(1, tabWidth);

	const code = grapheme.charCodeAt(0);
	if (grapheme.length === 1) {
		if (code >= 0x20 && code < 0x7f) return 1;
		if (code < 0x20) return 0;
	}

	return stringWidth(grapheme);
};

/** Columns a run of text takes up, laid out the way the text area lays it out. */
const textWidth = (text: string, tabWidth: number) => {
	let width = 0;
	for (const { segment } of SEGMENTER.segment(text)) {
		width += graphemeWidth(segment, tabWidth);
	}
	return width;
};

export const EditorUtils = {
	/**
	 * Lays the value out into the rows the text area renders, in order.
	 *
	 * @param width Columns available to the text, which is where lines wrap.
	 * @param lineCount Rows the editor keeps even while the value is shorter.
	 */
	rows: ({
		value,
		width,
		cursor,
		lineCount = 1,
		tabWidth = TAB_WIDTH,
	}: {
		value: string;
		width: number;
		cursor: EditorCursor;
		lineCount?: number;
		tabWidth?: number;
	}): EditorRow[] => {
		const lines = value.split("\n");
		const rows: EditorRow[] = [];

		for (const [line, text] of lines.entries()) {
			if (width <= 0 || text.length === 0) {
				rows.push({ line, column: 0, text, isVirtual: false });
				continue;
			}

			let chunk = "";
			let chunkWidth = 0;
			let column = 0;
			let lastWidth = 0;

			const flush = () => {
				rows.push({ line, column, text: chunk, isVirtual: false });
				lastWidth = chunkWidth;
				column += chunk.length;
				chunk = "";
				chunkWidth = 0;
			};

			for (const { segment } of SEGMENTER.segment(text)) {
				const size = graphemeWidth(segment, tabWidth);
				if (chunkWidth + size > width && chunk.length > 0) flush();
				chunk += segment;
				chunkWidth += size;
			}
			flush();

			// A line that fills its last row exactly leaves the cursor nowhere to
			// sit, so the text area opens an empty row for it.
			const [cursorLine, cursorColumn] = cursor;
			if (
				line === cursorLine &&
				cursorColumn === text.length &&
				cursorColumn > 0 &&
				lastWidth === width
			) {
				rows.push({ line, column: text.length, text: "", isVirtual: false });
			}
		}

		for (let line = lines.length; line < lineCount; line++) {
			rows.push({ line, column: 0, text: "", isVirtual: true });
		}

		return rows;
	},

	/** Which row the cursor is on, or -1 when it is on none of them. */
	row: ({
		rows,
		cursor: [line, column],
	}: {
		rows: readonly EditorRow[];
		cursor: EditorCursor;
	}) => {
		let index = -1;

		for (const [current, row] of rows.entries()) {
			if (row.line !== line || row.isVirtual) {
				// Past the line already, so the last match was the one.
				if (index >= 0) break;
				continue;
			}
			if (row.column > column) break;
			index = current;
		}

		return index;
	},

	/**
	 * The row the viewport starts at, following the scroll offset the text area
	 * keeps: it only moves far enough to bring the cursor back into view.
	 *
	 * @param height Rows the viewport shows at once.
	 */
	scroll: ({
		offset,
		index,
		count,
		height,
	}: {
		offset: number;
		index: number;
		count: number;
		height: number;
	}) => {
		const viewport = Math.max(1, height);

		let next = offset;
		if (index >= 0 && index < offset) next = index;
		else if (index >= offset + viewport) next = index - viewport + 1;

		return Math.min(Math.max(0, count - viewport), Math.max(0, next));
	},

	/**
	 * The position a point inside the text area points at, with the point given
	 * relative to the text area's top left corner.
	 *
	 * @param offset The row the viewport starts at, from {@link EditorUtils.scroll}.
	 */
	position: ({
		value,
		rows,
		point,
		offset,
		tabWidth = TAB_WIDTH,
	}: {
		value: string;
		rows: readonly EditorRow[];
		point: { x: number; y: number };
		offset: number;
		tabWidth?: number;
	}): EditorCursor => {
		const lines = value.split("\n");
		const row = rows[Math.min(Math.max(offset + point.y, 0), rows.length - 1)];

		// Below the value entirely: the end of it is the nearest place to be.
		if (!row || row.isVirtual) {
			return [lines.length - 1, (lines.at(-1) ?? "").length];
		}

		let column = 0;
		let consumed = 0;

		for (const { segment } of SEGMENTER.segment(row.text)) {
			const size = graphemeWidth(segment, tabWidth);
			if (point.x < consumed + size) break;
			consumed += size;
			column += segment.length;
		}

		return [row.line, row.column + column];
	},

	/** The cursor as an offset into the value, clamped to it. */
	offset: (value: string, [line, column]: EditorCursor) => {
		const lines = value.split("\n");
		const index = Math.max(0, Math.min(line, lines.length - 1));

		let offset = 0;
		for (let current = 0; current < index; current++) {
			offset += (lines[current] ?? "").length + 1;
		}

		return offset + Math.max(0, Math.min(column, (lines[index] ?? "").length));
	},

	/** The inverse of {@link EditorUtils.offset}. */
	cursor: (value: string, offset: number): EditorCursor => {
		let line = 0;
		let start = 0;

		for (let index = 0; index < offset; index++) {
			if (value[index] !== "\n") continue;
			line += 1;
			start = index + 1;
		}

		return [line, offset - start];
	},

	/**
	 * The offset a step onto the row above or below lands on, following the rows
	 * the text area lays out and holding the column the cursor was drawn at.
	 *
	 * @param rows The layout from {@link EditorUtils.rows}.
	 */
	vertical: ({
		value,
		rows,
		cursor,
		direction,
		tabWidth = TAB_WIDTH,
	}: {
		value: string;
		rows: readonly EditorRow[];
		cursor: EditorCursor;
		direction: 1 | -1;
		tabWidth?: number;
	}) => {
		const index = EditorUtils.row({ rows, cursor });
		if (index < 0) return EditorUtils.offset(value, cursor);

		const target = index + direction;

		// Off either end of the value, where the nearest place to be is its edge.
		if (target < 0) return 0;
		if (target >= rows.length || rows[target].isVirtual) return value.length;

		const row = rows[index];
		const x = textWidth(
			row.text.slice(0, Math.max(0, cursor[1] - row.column)),
			tabWidth,
		);

		return EditorUtils.offset(
			value,
			// The row is pointed at directly, so the viewport plays no part in it.
			EditorUtils.position({
				value,
				rows,
				point: { x, y: target },
				offset: 0,
				tabWidth,
			}),
		);
	},

	/** The selection in order, as offsets into the value. */
	range: ([anchor, focus]: EditorSelection): [start: number, end: number] =>
		anchor <= focus ? [anchor, focus] : [focus, anchor],

	/** The selected text, empty while nothing is selected. */
	selected: (value: string, selection: EditorSelection | null) => {
		if (!selection) return "";
		const [start, end] = EditorUtils.range(selection);
		return value.slice(start, end);
	},

	/**
	 * Rules that paint the selected text, for the text area's `labels`.
	 *
	 * It only styles by pattern and offers no way to point at a range, so the
	 * selected text is searched for literally and every match but the one it was
	 * taken from is left unlabelled.
	 */
	selectionLabels: (
		value: string,
		selection: EditorSelection | null,
	): TLabels => {
		const text = EditorUtils.selected(value, selection);
		if (!selection || !text) return [];

		const [start] = EditorUtils.range(selection);

		return [
			{
				pattern: new RegExp(text.replace(ESCAPED, "\\$&"), "g"),
				label: (match) => (match.index === start ? SELECTION_LABEL : undefined),
			},
		];
	},

	/**
	 * Rules that paint the commands and the attachments, for the text area's
	 * `labels`. They are read in order and the first rule to claim a character
	 * keeps it, so these come after the selection's.
	 */
	tokenLabels: (): TLabels => [
		{
			pattern: new RegExp(TOKEN_REGEX.source, "g"),
			label: (match) =>
				match[1] === "command" ? COMMAND_LABEL : ATTACHMENT_LABEL,
		},
	],

	/** Every command and attachment written into the value, in order. */
	tokens: (value: string): EditorToken[] =>
		[...value.matchAll(TOKEN_REGEX)].map((match) => ({
			start: match.index,
			end: match.index + match[0].length,
			label: match[1] === "command" ? COMMAND_LABEL : ATTACHMENT_LABEL,
		})),

	/** The token the offset sits inside of, ends excluded. */
	token: (value: string, offset: number) =>
		EditorUtils.tokens(value).find(
			({ start, end }) => offset > start && offset < end,
		) ?? null,

	/** Stretches a selection out to the ends of any token it reaches into. */
	expand: (value: string, selection: EditorSelection): EditorSelection => {
		const [start, end] = EditorUtils.range(selection);
		const reached = EditorUtils.tokens(value).filter(
			(token) => token.start < end && token.end > start,
		);
		if (reached.length === 0) return selection;

		const from = Math.min(start, reached[0].start);
		const to = Math.max(end, reached[reached.length - 1].end);

		// Kept pointing the way it was dragged, so it can go on growing either way.
		return selection[0] <= selection[1] ? [from, to] : [to, from];
	},

	/**
	 * The offset a cursor landing on this one should take instead, so that it
	 * never comes to rest inside a token. Moves along with the direction it was
	 * travelling, or out the near end when it did not travel at all.
	 */
	snap: (value: string, offset: number, from = offset) => {
		const token = EditorUtils.token(value, offset);
		if (!token) return offset;

		if (from <= token.start) return token.end;
		if (from >= token.end) return token.start;

		return offset - token.start < token.end - offset ? token.start : token.end;
	},

	/**
	 * The offset one step of the cursor lands on when a token is in the way,
	 * which is crossed whole. Null when there is none and the text area's own
	 * step is right.
	 */
	step: (value: string, offset: number, direction: 1 | -1) => {
		for (const { start, end } of EditorUtils.tokens(value)) {
			if (direction === -1 && offset > start && offset <= end) return start;
			if (direction === 1 && offset >= start && offset < end) return end;
		}

		return null;
	},

	/**
	 * The range a delete at the offset should take out, when a token is up
	 * against it or around it. Null when there is none and the text area's own
	 * delete is right.
	 */
	deletion: (
		value: string,
		offset: number,
		direction: 1 | -1,
	): [start: number, end: number] | null => {
		for (const { start, end } of EditorUtils.tokens(value)) {
			if (offset > start && offset < end) return [start, end];
			if (direction === -1 && offset === end) return [start, end];
			if (direction === 1 && offset === start) return [start, end];
		}

		return null;
	},

	/**
	 * The range an Alt delete at the offset should take out.
	 *
	 * A command or an attachment against the cursor goes whole, the way a plain
	 * delete takes it, and a word reaching into one is cut back to its near
	 * edge — so one press never takes a token and the text around it together.
	 */
	wordDeletion: (
		value: string,
		offset: number,
		direction: 1 | -1,
	): [start: number, end: number] => {
		const whole = EditorUtils.deletion(value, offset, direction);
		if (whole) return whole;

		const target =
			direction === -1
				? EditorUtils.wordStart(value, offset)
				: EditorUtils.wordEnd(value, offset);

		const [start, end] = direction === -1 ? [target, offset] : [offset, target];

		const reached = EditorUtils.tokens(value).filter(
			(token) => token.start < end && token.end > start,
		);
		if (reached.length === 0) return [start, end];

		// No token is against the cursor or around it, so every one the word
		// reached lies beyond the near edge it is cut back to.
		return direction === -1
			? [Math.max(...reached.map((token) => token.end)), offset]
			: [offset, Math.min(...reached.map((token) => token.start))];
	},

	/**
	 * The run of like characters the offset sits in, which a double click takes
	 * whole: a word, a stretch of punctuation, or the space between two of them.
	 *
	 * The run before the offset is taken over the space after it, so a click
	 * against the end of a word still takes the word.
	 */
	word: (value: string, offset: number): [start: number, end: number] => {
		const index = Math.max(0, Math.min(offset, value.length));

		const after = wordKind(value[index]);
		const kind =
			after && after !== "space"
				? after
				: (wordKind(value[index - 1]) ?? after);

		// Against a line's own edge, where there is no run to either side.
		if (!kind) return [index, index];

		let start = index;
		while (start > 0 && wordKind(value[start - 1]) === kind) start -= 1;

		let end = index;
		while (end < value.length && wordKind(value[end]) === kind) end += 1;

		return [start, end];
	},

	/**
	 * A selection dragged a word at a time, from the word it was started on out
	 * to the word it has reached. Kept pointing the way it was dragged, so it can
	 * go on growing either way.
	 */
	words: (
		value: string,
		[start, end]: [start: number, end: number],
		focused: number,
	): EditorSelection => {
		if (focused < start) return [end, EditorUtils.word(value, focused)[0]];
		if (focused > end) return [start, EditorUtils.word(value, focused)[1]];

		// Still on the word it was started on, which stands as it was taken.
		return [start, end];
	},

	/** Start of the word before the offset, skipping any whitespace in between. */
	wordStart: (value: string, offset: number) => {
		let index = offset - 1;
		while (index >= 0 && /\s/.test(value[index])) index -= 1;
		while (index >= 0 && !/\s/.test(value[index])) index -= 1;
		return index + 1;
	},

	/** End of the word after the offset, plus any whitespace trailing it. */
	wordEnd: (value: string, offset: number) => {
		let index = offset;
		while (index < value.length && !/\s/.test(value[index])) index += 1;
		while (index < value.length && /\s/.test(value[index])) index += 1;
		return index;
	},
} as const;
