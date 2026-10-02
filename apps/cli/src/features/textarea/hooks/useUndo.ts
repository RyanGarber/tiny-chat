import { useRef } from "react";

/** Edits kept to step back through. */
const MAX_UNDO = 128;

/** How soon after the last edit one of the same kind is folded into it. */
const GROUP_DELAY = 750;

type UndoEntry = { value: string; offset: number };

type UndoKind = "insert" | "delete";

/**
 * The history of a text area's edits. A run of keystrokes of one kind is one
 * step, so undo takes back a word rather than a character.
 */
export const useUndo = () => {
	const undoStack = useRef<UndoEntry[]>([]);
	const redoStack = useRef<UndoEntry[]>([]);
	const last = useRef<{ at: number; kind: UndoKind | null }>({
		at: 0,
		kind: null,
	});

	const push = (stack: UndoEntry[], entry: UndoEntry) => {
		if (stack.length >= MAX_UNDO) stack.shift();
		stack.push(entry);
	};

	return {
		/**
		 * Records the value as it stood before an edit of the kind given, which is
		 * folded into the last one while that was of the same kind and a breath
		 * ago.
		 *
		 * @param isWhole Whether the edit was made whole, like a paste or a word
		 * taken out, and ends the run rather than carrying it on.
		 */
		record: (kind: UndoKind, entry: UndoEntry, isWhole = false) => {
			// Any fresh edit invalidates the redo history.
			redoStack.current.length = 0;

			const now = Date.now();
			const isFolded =
				kind === last.current.kind && now - last.current.at < GROUP_DELAY;

			last.current = isWhole ? { at: 0, kind: null } : { at: now, kind };

			if (!isFolded) push(undoStack.current, entry);
		},

		undo: (entry: UndoEntry) => {
			last.current = { at: 0, kind: null };

			const previous = undoStack.current.pop();
			if (previous) push(redoStack.current, entry);
			return previous;
		},

		redo: (entry: UndoEntry) => {
			last.current = { at: 0, kind: null };

			const next = redoStack.current.pop();
			if (next) push(undoStack.current, entry);
			return next;
		},
	};
};
