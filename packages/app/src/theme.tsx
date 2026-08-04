import {
	type CSSVariablesResolver,
	createTheme,
	type MantineColorsTuple,
} from "@mantine/core";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";

const darkPalette: MantineColorsTuple = [
	"#C4C6CF", // [0]  near-white text — very slightly cool
	"#A2A4AD", // [1]
	"#858790", // [2]
	"#636570", // [3]
	"#35373e", // [4]
	"#292b32", // [5]  subtle borders
	"#1a1b22", // [6]  surface / card background
	"#131317", // [7]  body / AppShell background
	"#1e2027", // [8]
	"#141418", // [9]  deepest
];

export const theme = createTheme({
	fontFamily: "'Rubik', sans-serif",
	primaryColor: "blue",
	lineHeights: {
		md: "1.8",
	},
	defaultRadius: "lg",
	colors: {
		dark: darkPalette,
	},
	components: {
		Paper: {
			defaultProps: {
				radius: "lg",
			},
		},
		Modal: {
			defaultProps: {
				radius: "lg",
			},
			styles: {
				header: {
					background: "transparent",
				},
			},
		},
		Drawer: {
			styles: {
				header: {
					background: "transparent",
				},
				content: {
					borderRadius: 0,
					...StyleUtils.glass,
				},
			},
		},
		Dialog: {
			defaultProps: {
				radius: "lg",
			},
		},
		Popover: {
			defaultProps: {
				radius: "lg",
			},
		},
		Menu: {
			defaultProps: {
				radius: "lg",
			},
		},
		NavLink: {
			styles: {
				root: {
					borderRadius: "var(--mantine-radius-lg)",
				},
			},
		},
		Tooltip: {
			defaultProps: {
				radius: "lg",
			},
		},
		Tabs: {
			defaultProps: {
				radius: "lg",
			},
		},
		Spotlight: {
			styles: {
				content: {
					borderRadius: "var(--mantine-radius-lg)",
				},
			},
		},
		Card: {
			defaultProps: {
				radius: "lg",
			},
		},
		CheckboxCard: {
			styles: {
				card: {
					background: "var(--tc-surface)",
				},
			},
		},
		Input: {
			styles: {
				input: {
					backgroundColor: "var(--tc-surface)",
				},
			},
		},
	},
});

export const cssResolver: CSSVariablesResolver = () => ({
	variables: {
		"--mantine-color-body": "var(--tc-surface)",
	},
	light: {
		"--tc-exterior": "var(--mantine-color-gray-0)",
		"--tc-surface": "var(--mantine-color-gray-1)",
		"--tc-interior": "var(--mantine-color-gray-2)",
	},
	dark: {
		"--tc-exterior": "var(--mantine-color-dark-7)",
		"--tc-surface": "var(--mantine-color-dark-6)",
		"--tc-interior": "var(--mantine-color-dark-5)",
	},
});

/** @lintignore */
export default theme;
