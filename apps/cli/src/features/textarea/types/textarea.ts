/** A position in the value, as the line it is on and the column along it. */
export type TextareaCursor = [line: number, column: number];

/** A selected range, from where it was started to where it was dragged. */
export type TextareaSelection = [anchor: number, focus: number];

/** One row of the value as it is drawn, after long lines are wrapped. */
export type TextareaRow = {
	/** Index of the logical line the row is part of. */
	line: number;
	/** Column of that line the row starts at. */
	column: number;
	text: string;
};

/** How a run of text is drawn. */
export type TextareaStyle = {
	color?: string;
	bgColor?: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
};

/**
 * Styles by label, with `text` for whatever no label has claimed. A label of
 * several joined by `+` is drawn in all of their styles, the later ones over
 * the earlier.
 */
export type TextareaStyles = Readonly<Record<string, TextareaStyle>>;

/** A run of the value painted under a label, and a style of its own over it. */
export type TextareaRange = {
	start: number;
	end: number;
	label: string;
	style?: TextareaStyle;
};

/**
 * A rule that paints the value: whatever a pattern matches under a label, or
 * the ranges worked out from the value as a whole. Rules are read in order,
 * and the first one to claim a character keeps it.
 */
type TextareaLabel =
	| {
			pattern: RegExp;
			label: string | ((match: RegExpMatchArray) => string | undefined);
	  }
	| { ranges: (value: string) => Iterable<TextareaRange> };

export type TextareaLabels = readonly TextareaLabel[];

/**
 * An edit made whole in place of a key: the value it leaves, and the selection
 * over it — collapsed to the cursor where its two ends meet.
 */
export type TextareaEdit = { value: string; selection: TextareaSelection };
