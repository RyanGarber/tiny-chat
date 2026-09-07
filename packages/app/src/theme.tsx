import {
	type CSSVariablesResolver,
	createTheme,
	type MantineThemeOverride,
} from "@mantine/core";
import { palettes } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";

export const theme = createTheme({
	fontFamily: "'Rubik', sans-serif",
	primaryColor: "blue",
	lineHeights: {
		md: "1.8",
	},
	defaultRadius: "lg",
	colors: palettes,
	components: {
		AppShell: {
			classNames: {
				header: "glass",
				navbar: "glass",
				aside: "glass",
				footer: "glass",
			},
		},
		Paper: {
			defaultProps: {
				radius: "lg",
			},
			classNames: {
				root: "glass",
			},
		},
		Modal: {
			defaultProps: {
				radius: "lg",
			},
			classNames: {
				content: "glass",
				header: "mb-lg",
			},
		},
		Drawer: {
			classNames: {
				content: "glass",
				header: "mb-lg",
			},
		},
		Dialog: {
			defaultProps: {
				radius: "lg",
			},
			classNames: {
				root: "glass",
			},
		},
		Popover: {
			defaultProps: {
				radius: "lg",
				transitionProps: {
					transition: "fade-up",
				},
			},
			classNames: {
				dropdown: "glass",
			},
		},
		Menu: {
			defaultProps: {
				radius: "lg",
			},
			classNames: {
				dropdown: "glass",
			},
		},
		Combobox: {
			classNames: {
				dropdown: "glass",
			},
			defaultProps: {
				transitionProps: {
					transition: "fade-up",
				},
			},
		},
		Select: {
			classNames: {
				dropdown: "glass",
				input: "glass",
			},
		},
		TreeSelect: {
			classNames: {
				dropdown: "glass",
			},
		},
		NavLink: {
			defaultProps: {
				bdrs: "lg",
			},
		},
		Tooltip: {
			defaultProps: {
				radius: "lg",
				color: "var(--tc-surface)",
				position: "bottom",
			},
			classNames: {
				tooltip: "glass",
			},
		},
		Tabs: {
			defaultProps: {
				radius: "lg",
			},
		},
		Spotlight: {
			defaultProps: {
				radius: "lg",
			},
			classNames: {
				content: "glass",
			},
		},
		Card: {
			defaultProps: {
				radius: "lg",
			},
			classNames: {
				root: "glass",
			},
		},
		Input: {
			classNames: {
				input: "glass",
			},
		},
		CheckboxCard: {
			classNames: {
				card: "glass",
			},
		},
	},
} satisfies MantineThemeOverride);

export const cssResolver: CSSVariablesResolver = () => ({
	variables: {
		"--mantine-color-body": "var(--tc-surface)",
	},
	light: {
		"--tc-exterior": "var(--mantine-color-gray-0)",
		"--tc-surface": "var(--mantine-color-gray-1)",
		"--tc-interior": "var(--mantine-color-gray-2)",
		"--tc-highlight": "rgba(0, 0, 0, 0.05)",
		"--tc-shadow": "0 10px 40px rgba(0, 0, 0, 0.2)",
	},
	dark: {
		"--tc-exterior": "var(--mantine-color-dark-7)",
		"--tc-surface": "var(--mantine-color-dark-6)",
		"--tc-interior": "var(--mantine-color-dark-5)",
		"--tc-highlight": "rgba(255, 255, 255, 0.05)",
		"--tc-shadow": "0 10px 40px rgba(0, 0, 0, 0.2)",
	},
});

/** @lintignore */
export default theme;
