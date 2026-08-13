import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { Box, type BoxProps, type DOMElement, measureElement, Text } from "ink";
import { useContext, useEffect, useRef, useState } from "react";

export default function Divider(props: BoxProps) {
	const { colorScheme } = useContext(ThemeContext);

	const ref = useRef<DOMElement>(null);
	const [width, setWidth] = useState<number | "100%">("100%");

	useEffect(() => {
		setWidth(ref.current ? measureElement(ref.current).width : "100%");
	});

	return (
		<Box ref={ref} {...props}>
			<Text color={colorScheme.border} dimColor wrap="truncate">
				{"─".repeat(width === "100%" ? 1000 : width)}
			</Text>
		</Box>
	);
}
