import { Box } from "@mantine/core";
import { type ReactNode, useEffect, useRef } from "react";

/** Pixels from the bottom that still count as resting on it. */
const BOTTOM_THRESHOLD = 2;

/**
 * Holds growing content to a fixed height and keeps its end in view, the way
 * a terminal does, until the reader scrolls away from it; reaching the bottom
 * again picks the end back up. Released once the content settles.
 */
export default function Tail({
	follow,
	height,
	children,
	content,
}: {
	follow: boolean;
	height: number;
	children: ReactNode;
	content: unknown;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const inner = useRef<HTMLDivElement>(null);
	const pinned = useRef(true);

	// Each time it starts following, it starts from the end.
	useEffect(() => {
		if (follow) pinned.current = true;
	}, [follow]);

	// Only the reader moves the view up; the scrolls made below only ever move
	// it down. Its distance from the bottom alone can't tell them apart: a
	// scroll made below can be reported after more content has already landed.
	useEffect(() => {
		const outer = ref.current;
		if (!follow || !outer) return;
		let previous = outer.scrollTop;
		const onScroll = () => {
			const distance =
				outer.scrollHeight - outer.scrollTop - outer.clientHeight;
			if (distance <= BOTTOM_THRESHOLD) pinned.current = true;
			else if (outer.scrollTop < previous) pinned.current = false;
			previous = outer.scrollTop;
		};
		outer.addEventListener("scroll", onScroll, { passive: true });
		return () => outer.removeEventListener("scroll", onScroll);
	}, [follow]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scrolls as `content` grows
	useEffect(() => {
		if (follow && pinned.current && ref.current)
			ref.current.scrollTop = ref.current.scrollHeight;
	}, [follow, content]);

	// Content can also grow without `content` changing: streamed tool output,
	// a subagent's messages, a nested block of its own.
	useEffect(() => {
		const outer = ref.current;
		if (!follow || !outer || !inner.current) return;
		const observer = new ResizeObserver(() => {
			if (pinned.current) outer.scrollTop = outer.scrollHeight;
		});
		observer.observe(inner.current);
		return () => observer.disconnect();
	}, [follow]);

	if (!follow) return children;
	return (
		<Box ref={ref} mah={height} style={{ overflowY: "auto" }}>
			<div ref={inner}>{children}</div>
		</Box>
	);
}
