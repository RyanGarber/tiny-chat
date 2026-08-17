import {
	type ColorScheme,
	ThemeContext,
} from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import {
	ColorUtils,
	type Rgba,
} from "@tiny-chat/core/src/core/utils/ColorUtils.ts";
import { type ColorName, colorNames } from "chalk";
import { useContext, useMemo } from "react";
import type { LiteralUnion } from "type-fest";

export type ColorString = LiteralUnion<ColorName | keyof ColorScheme, string>;
export type ColorObject = Rgba;
export type Color = ColorString | ColorObject;

/**
 * Parses a color string, approximating transparency based on the theme.
 */
export const getColor = (
	color: Color | undefined,
	colorScheme: ColorScheme,
): string | undefined => {
	if (color === undefined) return undefined;

	// skip heavy color parsing for valid types
	if (typeof color === "string") {
		// find our own colors (primary, borderSubtle, etc.)
		if (color in colorScheme) {
			return colorScheme[color as keyof ColorScheme];
		}
		// find chalk colors (red, redBright, etc.)
		if (colorNames.includes(color as ColorName)) {
			return color;
		}
		// find other obviously valid colors
		if (color.startsWith("#") && color.length === 7) {
			return color;
		}
	}

	// parse all other colors, approximating transparency
	return ColorUtils.blend(colorScheme.surface, color);
};

export const useColor = (color?: Color) => {
	const { colorScheme } = useContext(ThemeContext);
	return useMemo(() => getColor(color, colorScheme), [color, colorScheme]);
};
