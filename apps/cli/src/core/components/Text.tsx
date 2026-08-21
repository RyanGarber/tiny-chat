import { Text as _Text, type TextProps as _TextProps } from "ink";
import { createContext, useContext, useMemo } from "react";
import { type Color, useColor } from "../hooks/useColor.ts";

export interface TextProps
	extends Omit<_TextProps, "color" | "backgroundColor"> {
	color?: Color;
	backgroundColor?: Color;
}

export interface TextContext
	extends Pick<TextProps, "color" | "dimColor" | "backgroundColor"> {}
export const TextContext = createContext<TextContext | undefined>(undefined);

export default function Text({
	color: _color,
	dimColor: _dimColor,
	backgroundColor: _backgroundColor,
	...props
}: TextProps) {
	const context = useContext(TextContext);

	// Held on the inherited values rather than the inherited object, so what is
	// handed down stays the same object for as long as the styling does. A value
	// that changed identity per render would re-render every text below it, past
	// any memo in between — context does not stop at one.
	const mergedContext = useMemo<TextContext>(
		() => ({
			color: _color ?? context?.color,
			dimColor: _dimColor ?? context?.dimColor,
			backgroundColor: _backgroundColor ?? context?.backgroundColor,
		}),
		[
			_color,
			context?.color,
			_dimColor,
			context?.dimColor,
			_backgroundColor,
			context?.backgroundColor,
		],
	);

	const color = useColor(mergedContext.color ?? "text");
	const dimColor = mergedContext.dimColor;
	const backgroundColor = useColor(mergedContext.backgroundColor);

	return (
		<TextContext value={mergedContext}>
			<_Text
				color={color}
				dimColor={dimColor}
				backgroundColor={backgroundColor}
				{...props}
			/>
		</TextContext>
	);
}
