import { type DOMElement, measureElement } from "ink";
import { useEffect, useRef, useState } from "react";
import Box from "./Box.tsx";
import Text from "./Text.tsx";

export default function Divider() {
	const ref = useRef<DOMElement>(null);
	const [width, setWidth] = useState<number | "100%">("100%");

	useEffect(() => {
		setWidth(ref.current ? measureElement(ref.current).width : "100%");
	});

	return (
		<Box ref={ref}>
			<Text color="border" dimColor wrap="truncate">
				{"─".repeat(width === "100%" ? 1000 : width)}
			</Text>
		</Box>
	);
}
