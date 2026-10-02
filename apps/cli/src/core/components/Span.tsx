import type { DOMElement } from "ink";
import { createElement, type ReactNode, type Ref } from "react";

/**
 * Inline text that hands out its node, which Ink's `<Text>` does not, so it
 * can be found on screen with `MouseUtils.textBounds`. Drawn as Ink draws a
 * `<Transform>`: a bare text element, which nested in a `<Text>` is inline.
 */
export default function Span({
	ref,
	children,
}: {
	ref?: Ref<DOMElement>;
	children?: ReactNode;
}) {
	return createElement("ink-text", { ref }, children);
}
