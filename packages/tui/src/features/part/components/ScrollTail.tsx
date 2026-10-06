import type { ReactNode } from "react";
import ScrollView from "#tui/core/components/ScrollView.tsx";

/** Rows content is held to while it is open on its own. */
const TAIL_ROWS = 20;

/**
 * Holds growing content to a fixed height and keeps its end in view, the way
 * a terminal does. Released once `follow` does, showing the whole of it.
 */
export default function ScrollTail({
	follow,
	children,
}: {
	follow: boolean;
	children: ReactNode;
}) {
	if (!follow) return children;
	return (
		// The wheel is left to the transcript this sits in, which would otherwise
		// scroll along with it.
		<ScrollView
			maxHeight={TAIL_ROWS}
			flexShrink={0}
			stickToBottom
			wheel={false}
			overscan={Number.POSITIVE_INFINITY}
		>
			{children}
		</ScrollView>
	);
}
