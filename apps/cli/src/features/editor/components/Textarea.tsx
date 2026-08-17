import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { useMergedRef } from "@tiny-chat/client/src/core/hooks/useMergedRef.ts";
import { type DOMElement, useBoxMetrics, useInput } from "ink";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { TextArea, type TextAreaProps, type TStyles } from "react-ink-textarea";
import Box from "../../../core/components/Box.tsx";
import { useMouseInput } from "../../../core/hooks/useMouseInput.ts";
import { ClipboardService } from "../../../core/services/ClipboardService.ts";
import { StdinUtils } from "../../../core/utils/StdinUtils.ts";
import {
	type EditorCursor,
	type EditorSelection,
	EditorUtils,
	SELECTION_LABEL,
} from "../utils/EditorUtils.ts";

/** How long a selection taken by keyboard is left to grow before it is copied. */
const COPY_DELAY = 200;

/** How long after a press a second one on the same spot still counts as a double click. */
const DOUBLE_CLICK_DELAY = 400;

/** Selected text is drawn the way the terminal draws its own selection. */
const STYLES: TStyles = {
	[SELECTION_LABEL]: { color: "black", bgColor: "blueBright" },
};

export type TextareaProps = Omit<
	TextAreaProps,
	"value" | "onChange" | "onSubmit" | "cursorPosition" | "onCursorChange"
> & {
	value: string;
	onChange: (value: string) => void;
	onSubmit?: (value: string) => void;
	/** The cursor, held here when it is left uncontrolled. */
	cursor?: EditorCursor;
	onCursorChange?: (cursor: EditorCursor) => void;
	/** The selection, held here when it is left uncontrolled. */
	selection?: EditorSelection | null;
	onSelectionChange?: (selection: EditorSelection | null) => void;
	/**
	 * Where a cursor landing on an offset should go instead, for a value with
	 * runs in it that are only ever handled whole.
	 */
	snap?: (offset: number, from?: number) => number;
	/** Stretches a selection out over any such run it reaches into. */
	expand?: (selection: EditorSelection) => EditorSelection;
};

/**
 * A text area that can be selected out of, with the mouse or with Shift and
 * the arrows.
 *
 * `react-ink-textarea` holds no selection of its own and ignores Shift
 * entirely, so the selection is kept out here: it is drawn through the labels
 * it paints text by, and stretched by handlers that run after its own, which
 * lets them settle the cursor wherever the selection ends up.
 */
export default function Textarea({
	value,
	onChange,
	onSubmit,
	cursor: controlledCursor,
	onCursorChange,
	selection: controlledSelection,
	onSelectionChange,
	snap,
	expand,
	focus,
	labels,
	styles,
	keybindings,
	initialLineCount = 1,
	disableArrowNavigation,
	...props
}: TextareaProps) {
	const { colorScheme } = useContext(ThemeContext);

	const mergedStyles = useMemo<TStyles>(() => {
		return {
			text: {
				color: colorScheme.text,
			},
			...styles,
		};
	}, [colorScheme, styles]);

	const [uncontrolledCursor, setUncontrolledCursor] = useState<EditorCursor>([
		0, 0,
	]);
	const [uncontrolledSelection, setUncontrolledSelection] =
		useState<EditorSelection | null>(null);

	const cursor = controlledCursor ?? uncontrolledCursor;
	const selection =
		controlledSelection !== undefined
			? controlledSelection
			: uncontrolledSelection;

	const setCursor = (next: EditorCursor) => {
		setUncontrolledCursor(next);
		onCursorChange?.(next);
	};

	const setSelection = (next: EditorSelection | null) => {
		setUncontrolledSelection(next);
		onSelectionChange?.(next);
	};

	// Where the selection was started, which it is stretched away from.
	const anchorRef = useRef(0);

	// Where and when the last press landed, which a second one on the same spot
	// turns into a double click.
	const pressRef = useRef({ at: 0, offset: -1 });

	// The word a double click took, which the drag after it goes on taking whole
	// words away from. Null while the selection is taken a character at a time.
	const wordRef = useRef<[start: number, end: number] | null>(null);

	const textRef = useRef<DOMElement | null>(null);
	const { width, height } = useBoxMetrics(textRef);

	const rows = useMemo(
		() =>
			EditorUtils.rows({
				value,
				width,
				cursor,
				lineCount: initialLineCount,
			}),
		[value, width, cursor, initialLineCount],
	);

	// The text area scrolls its rows internally once they outgrow the viewport,
	// and never says how far — so the offset is followed the same way it moves it.
	const offsetRef = useRef(0);
	useEffect(() => {
		offsetRef.current = EditorUtils.scroll({
			offset: offsetRef.current,
			index: EditorUtils.row({ rows, cursor }),
			count: rows.length,
			height,
		});
	}, [rows, cursor, height]);

	// Where a point was pressed or dragged to, kept out of the middle of
	// anything that goes as one.
	const pointed = (event: { x: number; y: number }, from?: number) => {
		const offset = EditorUtils.offset(
			value,
			EditorUtils.position({
				value,
				rows,
				point: event,
				offset: offsetRef.current,
			}),
		);
		return snap?.(offset, from) ?? offset;
	};

	// Turning the mouse on takes the terminal's own select-to-copy away, so what
	// was selected is handed to the clipboard in its place.
	const copy = (selected: EditorSelection) => {
		ClipboardService.copy(EditorUtils.selected(value, selected));
	};

	// A selection taken a key at a time would otherwise be written out on every
	// one of them, so the write waits for the last.
	const copyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const copyLater = (selected: EditorSelection) => {
		if (copyRef.current) clearTimeout(copyRef.current);
		copyRef.current = setTimeout(() => copy(selected), COPY_DELAY);
	};

	useEffect(
		() => () => {
			if (copyRef.current) clearTimeout(copyRef.current);
		},
		[],
	);

	/**
	 * The selection from its anchor out to where it was taken, by the word once
	 * a double click has started it on one.
	 */
	const stretched = (focused: number): EditorSelection => {
		const word = wordRef.current;
		const selected: EditorSelection = word
			? EditorUtils.words(value, word, focused)
			: [anchorRef.current, focused];

		// Nothing is selected yet, and a cursor reaches into no run of its own.
		if (selected[0] === selected[1]) return selected;

		return expand?.(selected) ?? selected;
	};

	/** Stretches the selection out and follows it with the cursor. */
	const reach = (focused: number) => {
		const selected = stretched(focused);
		setCursor(EditorUtils.cursor(value, selected[1]));

		if (selected[0] === selected[1]) {
			setSelection(null);
			return null;
		}

		setSelection(selected);

		return selected;
	};

	const { mouseRef } = useMouseInput({
		onClick: ({ event }) => {
			const pressed = pointed(event);
			const now = Date.now();

			// A second press where the last one landed takes the word under it, and
			// the drag that follows goes on taking whole words rather than characters.
			const isDouble =
				pressed === pressRef.current.offset &&
				now - pressRef.current.at < DOUBLE_CLICK_DELAY;

			pressRef.current = { at: now, offset: pressed };
			wordRef.current = isDouble ? EditorUtils.word(value, pressed) : null;
			anchorRef.current = pressed;

			if (isDouble) {
				reach(pressed);
				return;
			}

			setCursor(EditorUtils.cursor(value, pressed));
			setSelection(null);
		},
		onDrag: ({ event }) => {
			reach(pointed(event, anchorRef.current));
		},
		onDragEnd: ({ event }) => {
			copy(stretched(pointed(event, anchorRef.current)));
		},
		isActive: focus,
	});

	const offset = EditorUtils.offset(value, cursor);

	// The text area follows a write of its own with a cursor of its own, which
	// would land after the text it inserted rather than after the text that
	// replaced the selection. It is dropped, until the next render brings the
	// replacement in and the cursor is reported against it.
	const replacedRef = useRef(false);
	useEffect(() => {
		replacedRef.current = false;
	});

	// The text area knows nothing of the selection, so it writes what was typed
	// in at the cursor. An insertion made while text is selected is turned into a
	// replacement of it here, before it is handed on, which catches a paste as
	// well as a key.
	const handleChange = (next: string) => {
		const length = next.length - value.length;
		const text = next.slice(offset, offset + length);

		if (
			selection &&
			length > 0 &&
			next === value.slice(0, offset) + text + value.slice(offset)
		) {
			const [start, end] = EditorUtils.range(selection);
			const replaced = value.slice(0, start) + text + value.slice(end);

			replacedRef.current = true;
			onChange(replaced);
			setCursor(EditorUtils.cursor(replaced, start + text.length));
			setSelection(null);
			return;
		}

		onChange(next);
	};

	// Shift and an arrow, which the text area answers as a plain arrow and moves
	// the cursor by. This runs after it and settles the cursor at the end of the
	// selection instead, so the one step it took is undone. Alt takes a whole
	// word at a time, over the same ground Alt and the arrow alone step across.
	useInput(
		(_input, key) => {
			if (disableArrowNavigation) return;

			const isVertical = key.upArrow || key.downArrow;
			if (!isVertical && !key.leftArrow && !key.rightArrow) return;

			// A terminal that cannot say Shift was held sends the press as a bare
			// escaped arrow, which is taken as Shift without Alt: the selection is
			// stretched, a character at a time, rather than nothing happening at all.
			const isEscaped = !key.shift && StdinUtils.isEscapedArrow();
			if (!key.shift && !isEscaped) return;

			// A selection starts where the cursor already was, and one already taken
			// carries on from the end it was anchored at, however it was taken.
			anchorRef.current = selection ? selection[0] : offset;
			wordRef.current = null;

			const focused = isVertical
				? EditorUtils.vertical({
						value,
						rows,
						cursor,
						direction: key.upArrow ? -1 : 1,
					})
				: key.meta && !isEscaped
					? key.leftArrow
						? EditorUtils.wordStart(value, offset)
						: EditorUtils.wordEnd(value, offset)
					: Math.min(
							Math.max(offset + (key.leftArrow ? -1 : 1), 0),
							value.length,
						);

			const selected = reach(focused);
			if (selected) copyLater(selected);
		},
		{ isActive: focus },
	);

	// The text area deletes a character at a time, or a word at a time under Alt,
	// and knows nothing of the selection, so a delete over one is answered here
	// instead — including the Alt and Shift delete that took the selection.
	useInput(
		(_input, key) => {
			if (!selection) return;

			// Left standing while it is still being stretched, by Shift and an
			// arrow or by the escaped arrow a terminal sends in its place.
			if (
				(key.shift || StdinUtils.isEscapedArrow()) &&
				(key.leftArrow || key.rightArrow || key.upArrow || key.downArrow)
			)
				return;

			if (key.backspace || key.delete) {
				const [start, end] = EditorUtils.range(selection);
				onChange(value.slice(0, start) + value.slice(end));
				setCursor(EditorUtils.cursor(value, start));
			}

			// Any other key leaves the selection behind rather than acting on it.
			setSelection(null);
		},
		{ isActive: focus },
	);

	const ref = useMergedRef(textRef, mouseRef);

	return (
		<Box ref={ref} flexGrow={1}>
			<TextArea
				focus={focus}
				value={value}
				cursorPosition={cursor}
				onChange={handleChange}
				onSubmit={(submitted) => onSubmit?.(submitted)}
				onCursorChange={(position) => {
					if (replacedRef.current) return;
					setCursor(position);
				}}
				// A selection is taken out whole, above, rather than a character or a
				// word at a time.
				keybindings={{
					...keybindings,
					Backspace: (keybindings?.Backspace ?? true) && !selection,
					Delete: (keybindings?.Delete ?? true) && !selection,
					"Alt+Backspace":
						(keybindings?.["Alt+Backspace"] ?? true) && !selection,
				}}
				disableArrowNavigation={disableArrowNavigation}
				initialLineCount={initialLineCount}
				labels={[
					...EditorUtils.selectionLabels(value, selection),
					...(labels ?? []),
				]}
				styles={{ ...STYLES, ...mergedStyles }}
				{...props}
			/>
		</Box>
	);
}
