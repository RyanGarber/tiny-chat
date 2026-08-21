import type { RootContent } from "mdast";
import { processor } from "../hooks/useMarkdown.ts";

/**
 * Nodes a renderer cannot read in isolation: a definition sits wherever the
 * author put it but is referenced from anywhere in the document, so splitting
 * would leave the reference with nothing to resolve against. Raw HTML reaches
 * past its own node in the same way — an unclosed tag wraps the blocks below it
 * once rehype reparses it, which only holds while they share a tree.
 */
const UNSPLITTABLE = new Set<RootContent["type"]>([
	"definition",
	"footnoteDefinition",
	"html",
]);

/**
 * Containers a blank line does not close for good: a later item at the same
 * marker joins the list above it rather than starting a new one, which turns
 * two blocks back into one.
 */
const RESUMABLE = new Set<RootContent["type"]>([
	"list",
	"blockquote",
	"containerDirective",
]);

const BLANK = /\n[ \t]*\n/;

interface Block {
	type: RootContent["type"];
	start: number;
	end: number;
}

/** A document split into blocks, and what it takes to extend that split. */
export interface MarkdownBlocks {
	/** Content the blocks were cut from. */
	content: string;
	/** Block sources, in order, exactly as they appear in the content. */
	blocks: string[];
	/** Where a reparse has to start to take appended text into account. */
	offset: number;
	/** How many blocks precede that offset. */
	index: number;
	/** Whether the content could be split at all. */
	split: boolean;
}

const parse = (content: string, at: number): Block[] | undefined => {
	const blocks: Block[] = [];

	for (const node of processor.parse(content.slice(at)).children) {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		if (UNSPLITTABLE.has(node.type) || start == null || end == null)
			return undefined;

		blocks.push({ type: node.type, start: at + start, end: at + end });
	}

	return blocks;
};

/**
 * The first block of those that appended text can still rewrite.
 *
 * The last block is always one of them, and so is every block above it whose
 * boundary an append can dissolve — a paragraph that a following line turns
 * into a setext heading or a table, an item that joins the list above it.
 */
const unstable = (content: string, blocks: Block[]) => {
	let index = blocks.length - 1;

	while (index > 0) {
		const previous = blocks[index - 1];
		const closed =
			!RESUMABLE.has(previous.type) &&
			BLANK.test(content.slice(previous.end, blocks[index].start));
		if (closed) break;
		index--;
	}

	return index;
};

export const MarkdownUtils = {
	/**
	 * Cuts markdown into its top-level blocks, each of which parses to the same
	 * tree on its own as it does as part of the whole document.
	 *
	 * A renderer that splits first can memoize per block, so a block that has
	 * scrolled off the tail of a stream costs nothing on later chunks — no
	 * reparse, no tree walk, no reconciliation. Without it, every chunk repeats
	 * all of that for everything already on screen, and the cost per chunk grows
	 * with the length of the message.
	 *
	 * The boundaries come from the same parser the renderer uses (`processor`
	 * carries the syntax extensions of our remark plugins), so a construct that
	 * spans blank lines — a loose list, a fenced block, a container directive —
	 * stays in one piece.
	 *
	 * @param previous The last split of this same document, if there is one.
	 * 	Text appended to it can only rewrite the blocks at its end, so the parse
	 * 	starts there instead of at the top. Without this, splitting costs a parse
	 * 	of the whole document per chunk — the very cost the split exists to
	 * 	remove, since parsing is most of it.
	 */
	split: ({
		content,
		previous,
	}: {
		content: string;
		previous?: MarkdownBlocks;
	}): MarkdownBlocks => {
		if (previous?.content === content) return previous;

		const appended =
			previous?.split &&
			content.length > previous.content.length &&
			content.startsWith(previous.content);

		const at = appended ? previous.offset : 0;
		const parsed = parse(content, at);

		// A window that cannot be split on its own says nothing about the rest of
		// the document, so give up on the whole of it rather than on the tail.
		if (!parsed)
			return { content, blocks: [content], offset: 0, index: 0, split: false };

		const kept = appended ? previous.blocks.slice(0, previous.index) : [];
		const index = unstable(content, parsed);

		return {
			content,
			blocks: [
				...kept,
				...parsed.map((block) => content.slice(block.start, block.end)),
			],
			// Nothing in the window is settled yet when the first block of it is
			// still open, so the window cannot shrink past where it began.
			offset: index > 0 ? parsed[index].start : at,
			index: index > 0 ? kept.length + index : kept.length,
			split: true,
		};
	},
} as const;
