import { useEffect, useRef, useState } from "react";
import { useMouseInput } from "../hooks/useMouseInput.ts";
import Box, { type BoxProps } from "./Box.tsx";
import Text from "./Text.tsx";

/**
 * A bracketed text button, dimmed while hovered.
 *
 * `labelOnClick` stands in for `label` for a moment after a click, to confirm
 * an action that has nothing else to show for itself (a copy, say). A
 * disabled one is drawn dimmed, and neither hovers nor clicks.
 */
export default function Button({
	label,
	labelOnClick,
	onClick,
	timeout = 2000,
	disabled = false,
	...props
}: Omit<BoxProps, "children"> & {
	label: string;
	labelOnClick?: string;
	onClick?: () => unknown;
	timeout?: number;
	disabled?: boolean;
}) {
	const [hover, setHover] = useState(false);
	const [clicked, setClicked] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const { mouseRef } = useMouseInput({
		onClick: () => {
			onClick?.();
			if (!labelOnClick) return;
			setClicked(true);
			clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setClicked(false), timeout);
		},
		onHoverStart: () => setHover(true),
		onHoverEnd: () => setHover(false),
		isActive: !disabled,
	});

	useEffect(() => () => clearTimeout(timeoutRef.current), []);

	return (
		<Box ref={(element) => mouseRef(element, 0)} flexShrink={0} {...props}>
			<Text color="textSubtle" dimColor={disabled || hover}>
				[{clicked && labelOnClick ? labelOnClick : label}]
			</Text>
		</Box>
	);
}
