import { Box } from "@mantine/core";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * Holds growing content to a fixed height and keeps its end in view, the way
 * a terminal does. Released once the content settles.
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: scrolls as `content` grows
	useEffect(() => {
		if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
	}, [follow, content]);

	if (!follow) return children;
	return (
		<Box ref={ref} mah={height} style={{ overflowY: "auto" }}>
			{children}
		</Box>
	);
}
