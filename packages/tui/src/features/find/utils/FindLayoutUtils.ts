import { type DOMElement, measureElement } from "ink";
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";
import type { FindBlock, FindMatch } from "#client/features/find/types/find.ts";
import { revealRow } from "#tui/core/components/ScrollView.tsx";

type DOMNode = DOMElement["childNodes"][number];

/** A row of a match as drawn, placed in cells from the searched element's content. */
export interface FindHighlight {
	x: number;
	y: number;
	text: string;
	current: boolean;
}

/** Where each character of a block's text is drawn, once Ink has wrapped it. */
interface TextLayout {
	x: number;
	y: number;
	/** By index into the block's text; a character wrapping dropped sits where it would have. */
	cells: { line: number; column: number }[];
	/** Columns past which a truncated block draws nothing. */
	maxWidth: number;
	truncated: boolean;
}

/** The text a node shows, as Ink squashes it before styling it. */
const textOf = (node: DOMNode): string => {
	if (node.nodeName === "#text") return node.nodeValue;
	if (node.isHidden) return "";
	return node.childNodes.map(textOf).join("");
};

/** A block's text with tabs expanded, which Ink does before measuring it. */
const blockText = (node: DOMElement) => {
	const text = textOf(node).replaceAll("\r\n", "\n");
	return text.includes("\t")
		? wrapAnsi(text, Number.POSITIVE_INFINITY, { trim: false })
		: text;
};

/**
 * Walks `text` alongside `wrapped`, which only differs from it by the line
 * breaks wrapping added and the spaces it broke on.
 */
const cellsOf = (text: string, wrapped: string) => {
	const cells: TextLayout["cells"] = [];
	let line = 0;
	let column = 0;
	let j = 0;
	for (let i = 0; i < text.length; ) {
		// biome-ignore lint/style/noNonNullAssertion: i is within text
		const character = String.fromCodePoint(text.codePointAt(i)!);
		if (wrapped.startsWith(character, j)) {
			for (let k = 0; k < character.length; k++)
				cells[i + k] = { line, column };
			if (character === "\n") {
				line++;
				column = 0;
			} else column += stringWidth(character);
			i += character.length;
			j += character.length;
		} else if (wrapped[j] === "\n") {
			j++;
			line++;
			column = 0;
		} else {
			cells[i] = { line, column };
			i++;
		}
	}
	return cells;
};

/** Lays a block out the way Ink's renderer does, from the layout it computed. */
const layoutOf = (node: DOMElement): TextLayout | null => {
	if (!node.yogaNode) return null;
	const { x, y, width } = measureElement(node);
	const text = blockText(node);
	const textWrap = node.style.textWrap ?? "wrap";
	const fits = text.split("\n").every((line) => stringWidth(line) <= width);
	const truncated = !fits && textWrap.startsWith("truncate");
	const wrapped =
		fits || truncated
			? text
			: wrapAnsi(text, Math.max(1, width), {
					trim: false,
					hard: true,
					wordWrap: textWrap === "wrap",
				});
	return { x, y, cells: cellsOf(text, wrapped), maxWidth: width, truncated };
};

/** The box an ancestor clips its content to, if it clips at all. */
const clipOf = (node: DOMElement) => {
	const { overflow, overflowX, overflowY } = node.style;
	const clipX = (overflowX ?? overflow) === "hidden";
	const clipY = (overflowY ?? overflow) === "hidden";
	if (!clipX && !clipY) return null;
	const { x, y, width, height } = measureElement(node);
	return {
		left: clipX ? x : Number.NEGATIVE_INFINITY,
		right: clipX ? x + width : Number.POSITIVE_INFINITY,
		top: clipY ? y : Number.NEGATIVE_INFINITY,
		bottom: clipY ? y + height : Number.POSITIVE_INFINITY,
	};
};

/** Whether a row of cells is drawn rather than clipped by a view it sits in. */
const isVisible = (
	node: DOMElement,
	root: DOMElement,
	{ x, y, width }: { x: number; y: number; width: number },
) => {
	for (let parent = node.parentNode; parent; parent = parent.parentNode) {
		const clip = clipOf(parent);
		if (
			clip &&
			(y < clip.top ||
				y >= clip.bottom ||
				x < clip.left ||
				x + width > clip.right)
		)
			return false;
		if (parent === root) break;
	}
	return true;
};

export const FindLayoutUtils = {
	/**
	 * Every block of text drawn under `root` — each `<Text>` holding inline
	 * text nested in it — skipping what is hidden and whatever is under `skip`.
	 */
	*blocks(
		root: DOMElement,
		skip: (DOMElement | null)[] = [],
	): Generator<FindBlock<DOMElement>> {
		if (skip.includes(root) || root.style.display === "none") return;
		if (root.nodeName === "ink-text") {
			const text = blockText(root);
			if (text) yield [{ node: root, text }];
			return;
		}
		for (const child of root.childNodes)
			if (child.nodeName !== "#text")
				yield* FindLayoutUtils.blocks(child, skip);
	},

	/**
	 * Where matches are drawn, row by row, relative to the content box of
	 * `root` — where a child of it positioned absolutely at the same offsets
	 * covers them. Rows a view has scrolled out of sight are left out.
	 */
	highlights: (
		root: DOMElement,
		matches: FindMatch<DOMElement>[],
		current: number,
	): FindHighlight[] => {
		const origin = measureElement(root);
		const borderLeft =
			root.style.borderStyle && root.style.borderLeft !== false;
		const borderTop = root.style.borderStyle && root.style.borderTop !== false;
		const originX = origin.x + (borderLeft ? 1 : 0);
		const originY = origin.y + (borderTop ? 1 : 0);

		const layouts = new Map<DOMElement, TextLayout | null>();
		const highlights: FindHighlight[] = [];

		matches.forEach((match, index) => {
			for (const { node, start, end } of match.pieces) {
				if (!layouts.has(node)) layouts.set(node, layoutOf(node));
				const layout = layouts.get(node);
				if (!layout) continue;
				const text = blockText(node);

				// One row per line the match is drawn across.
				let row: {
					line: number;
					column: number;
					from: number;
					to: number;
				} | null = null;
				const flush = () => {
					if (!row) return;
					const segment = text.slice(row.from, row.to);
					const width = stringWidth(segment);
					const cell = {
						x: layout.x + row.column,
						y: layout.y + row.line,
						width,
					};
					const clipped =
						layout.truncated && row.column + width > layout.maxWidth;
					if (segment && !clipped && isVisible(node, root, cell))
						highlights.push({
							x: cell.x - originX,
							y: cell.y - originY,
							text: segment,
							current: index === current,
						});
					row = null;
				};
				for (let i = start; i < end; i++) {
					const cell = layout.cells[i];
					if (!cell || text[i] === "\n") {
						flush();
						continue;
					}
					if (row && cell.line !== row.line) flush();
					if (!row) row = { ...cell, from: i, to: i };
					row.to = i + 1;
				}
				flush();
			}
		});

		return highlights;
	},

	/** Scrolls whatever view holds a match until its first row is in sight. */
	reveal: (match: FindMatch<DOMElement>) => {
		const { node, offset } = match.start;
		const layout = layoutOf(node);
		if (!layout) return;
		revealRow(node, layout.y + (layout.cells[offset]?.line ?? 0));
	},
} as const;
