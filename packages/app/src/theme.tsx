import { type CSSVariablesResolver, createTheme } from "@mantine/core";
import { palettes } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";

export const theme = createTheme({
	fontFamily: "'Rubik', sans-serif",
	primaryColor: "blue",
	lineHeights: {
		md: "1.8",
	},
	defaultRadius: "lg",
	colors: palettes,
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
