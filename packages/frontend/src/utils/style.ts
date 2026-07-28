import type { CSSProperties } from "react";

export const THEMES = ["dark", "light"] as const;

export const CODE_THEMES = [
	"andromeeda",
	"aurora-x",
	"ayu-dark",
	"ayu-light",
	"ayu-mirage",
	"catppuccin-frappe",
	"catppuccin-latte",
	"catppuccin-macchiato",
	"catppuccin-mocha",
	"dark-plus",
	"dracula",
	"dracula-soft",
	"everforest-dark",
	"everforest-light",
	"github-dark",
	"github-dark-default",
	"github-dark-dimmed",
	"github-dark-high-contrast",
	"github-light",
	"github-light-default",
	"github-light-high-contrast",
	"gruvbox-dark-hard",
	"gruvbox-dark-medium",
	"gruvbox-dark-soft",
	"gruvbox-light-hard",
	"gruvbox-light-medium",
	"gruvbox-light-soft",
	"horizon",
	"horizon-bright",
	"houston",
	"kanagawa-dragon",
	"kanagawa-lotus",
	"kanagawa-wave",
	"laserwave",
	"light-plus",
	"material-theme",
	"material-theme-darker",
	"material-theme-lighter",
	"material-theme-ocean",
	"material-theme-palenight",
	"min-dark",
	"min-light",
	"monokai",
	"night-owl",
	"night-owl-light",
	"nord",
	"one-dark-pro",
	"one-light",
	"plastic",
	"poimandres",
	"red",
	"rose-pine",
	"rose-pine-dawn",
	"rose-pine-moon",
	"slack-dark",
	"slack-ochin",
	"snazzy-light",
	"solarized-dark",
	"solarized-light",
	"synthwave-84",
	"tokyo-night",
	"vesper",
	"vitesse-black",
	"vitesse-dark",
	"vitesse-light",
] as const;

export const codeThemesByTheme = (theme: (typeof THEMES)[number]) => {
	return theme === "dark"
		? CODE_THEMES.filter((t) => !t.includes("light"))
		: CODE_THEMES.filter((t) => !t.includes("dark"));
};

export const SHADOW = "rgba(0, 0, 0, 0.2) 2px 0px 15px";

const GLASS_BG = "color-mix(in srgb, var(--tc-surface), transparent 15%)";
const GLASS_BLUR = "blur(10px)";
const GLASS_BORDER =
	"1px solid color-mix(in srgb, var(--tc-surface), #ffffff 15%)";
export const GLASS_STYLE: CSSProperties = {
	backgroundColor: GLASS_BG,
	backdropFilter: GLASS_BLUR,
	border: GLASS_BORDER,
};

export const INPUT_STYLE = {
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
} as never;
