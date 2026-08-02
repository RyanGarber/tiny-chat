import type { InputBaseProps } from "@mantine/core";
import type { CSSProperties } from "react";

const GLASS_BG = "color-mix(in srgb, var(--tc-surface), transparent 15%)";
const GLASS_BLUR = "blur(10px)";
const GLASS_BORDER =
	"1px solid color-mix(in srgb, var(--tc-surface), #ffffff 15%)";

export const StyleUtils = {
	shadow: "rgba(0, 0, 0, 0.2) 2px 0px 15px",

	glass: {
		backgroundColor: GLASS_BG,
		backdropFilter: GLASS_BLUR,
		border: GLASS_BORDER,
	} satisfies CSSProperties,

	input: {
		root: {
			position: "relative",
		},
		input: {
			height: 54,
			paddingTop: 18,
		},
		label: {
			position: "absolute",
			pointerEvents: "none",
			fontSize: "var(--mantine-font-size-xs)",
			paddingLeft: "var(--mantine-spacing-sm)",
			paddingTop: "calc(var(--mantine-spacing-sm) / 2)",
			zIndex: 1,
		},
	} satisfies InputBaseProps["styles"] as any,
} as const;
