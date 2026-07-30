import { cloneElement, isValidElement, type ReactNode } from "react";

/**
 * Recursively trims leading/trailing newline characters from a `children`
 * ReactNode tree — the kind passed into custom component renderers used by
 * react-markdown / Streamdown (e.g. `p: ({ children }) => ...`).
 *
 * Only touches the very first and very last text leaves in the tree; all
 * other whitespace, structure, and element props are left untouched.
 *
 * Example:
 *   p: ({ children }) => <p>{trimNewlines(children)}</p>
 */
export function trim(children: ReactNode): ReactNode {
	const afterStart = trimEdge(children, "start").node;
	const afterEnd = trimEdge(afterStart, "end").node;
	return afterEnd;
}

type TrimResult = {
	node: ReactNode;
	/** true once a real (non-empty) leaf has been found/trimmed, signaling the walk should stop */
	done: boolean;
};

function trimEdge(node: ReactNode, edge: "start" | "end"): TrimResult {
	if (Array.isArray(node)) {
		const items = node.slice();
		const order = items.map((_, i) => i);
		if (edge === "end") order.reverse();

		for (const i of order) {
			const result = trimEdge(items[i], edge);
			items[i] = result.node;
			if (result.done) {
				return { node: items, done: true };
			}
			// Child collapsed to nothing (e.g. empty string) — drop it, keep scanning.
			if (isEmpty(items[i])) {
				items[i] = null;
			}
		}
		return { node: items, done: false };
	}

	if (typeof node === "string" || typeof node === "number") {
		const str = String(node);
		const trimmed =
			edge === "start" ? str.replace(/^\n+/, "") : str.replace(/\n+$/, "");
		return { node: trimmed, done: trimmed.length > 0 };
	}

	if (isValidElement(node)) {
		const props = node.props as { children?: ReactNode };
		const hasChildren = props != null && "children" in props;

		if (!hasChildren) {
			// Leaf element with no children (e.g. <img/>, <hr/>, <br/>) counts as
			// real content — stop the walk here without altering it.
			return { node, done: true };
		}

		const result = trimEdge(props?.children, edge);
		const cloned = cloneElement(node, undefined, result.node);
		return { node: cloned, done: result.done || !isEmpty(result.node) };
	}

	// null / undefined / boolean / other non-content nodes — nothing to trim,
	// and they shouldn't block the search for the next real leaf.
	return { node, done: false };
}

function isEmpty(node: ReactNode): boolean {
	if (node === null || node === undefined || typeof node === "boolean") {
		return true;
	}
	if (typeof node === "string") {
		return node.length === 0;
	}
	if (Array.isArray(node)) {
		return node.every(isEmpty);
	}
	return false;
}
