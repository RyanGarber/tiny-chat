import { Box as _Box, type BoxProps as _BoxProps, type DOMElement } from "ink";
import { type ReactNode, type RefAttributes, useContext, useMemo } from "react";
import { type Border, useBorder } from "../hooks/useBorder.ts";
import { type Color, useColor } from "../hooks/useColor.ts";
import { TextContext } from "./Text.tsx";

export interface BoxProps
	extends Omit<
		_BoxProps,
		| "backgroundColor"
		| "border"
		| "borderTop"
		| "borderBottom"
		| "borderLeft"
		| "borderRight"
	> {
	backgroundColor?: Color;
	border?: Border;
	borderTop?: Border;
	borderBottom?: Border;
	borderLeft?: Border;
	borderRight?: Border;
}

export default function Box({
	color,
	dimColor,
	backgroundColor: _backgroundColor,
	border: _border,
	borderTop: _borderTop,
	borderBottom: _borderBottom,
	borderLeft: _borderLeft,
	borderRight: _borderRight,
	...props
}: BoxProps &
	TextContext & { children?: ReactNode } & RefAttributes<DOMElement>) {
	const context = useContext(TextContext);

	const backgroundColor = useColor(_backgroundColor);
	const border = useBorder(_border);
	const borderTop = useBorder(_borderTop);
	const borderBottom = useBorder(_borderBottom);
	const borderLeft = useBorder(_borderLeft);
	const borderRight = useBorder(_borderRight);

	const borderProps = useMemo<_BoxProps>(() => {
		const borders = [border, borderTop, borderBottom, borderLeft, borderRight];

		const borderStyle =
			borders.find((border) => border?.style)?.style ?? "round";

		const conflictingStyle = borders.some(
			(border) => border?.style && border?.style !== borderStyle,
		);
		if (conflictingStyle) {
			throw new Error("conflicting border styles");
		}

		return {
			borderStyle,
			borderColor: border?.color,
			borderLeft: borderLeft === null ? false : Boolean(borderLeft || border),
			borderLeftColor: borderLeft?.color,
			borderRight:
				borderRight === null ? false : Boolean(borderRight || border),
			borderRightColor: borderRight?.color,
			borderTop: borderTop === null ? false : Boolean(borderTop || border),
			borderTopColor: borderTop?.color,
			borderBottom:
				borderBottom === null ? false : Boolean(borderBottom || border),
			borderBottomColor: borderBottom?.color,
		};
	}, [border, borderTop, borderBottom, borderLeft, borderRight]);

	const mergedContext = useMemo<TextContext>(
		() => ({
			color: color ?? context?.color,
			dimColor: dimColor ?? context?.dimColor,
		}),
		[color, context?.color, dimColor, context?.dimColor],
	);

	return (
		<TextContext value={mergedContext}>
			<_Box backgroundColor={backgroundColor} {...borderProps} {...props} />
		</TextContext>
	);
}
