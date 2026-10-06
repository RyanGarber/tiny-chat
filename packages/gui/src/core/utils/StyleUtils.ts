import type { InputBaseProps } from "@mantine/core";

export const StyleUtils = {
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
