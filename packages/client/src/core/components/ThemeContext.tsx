import type { ThemeUtils } from "@tiny-chat/core/src/core/utils/ThemeUtils.ts";
import { createContext, createElement, type ReactNode } from "react";
import { useThemes } from "../../features/settings/hooks/useThemes.ts";

export type ColorPalette = [
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
];

export type ColorScheme = {
	surface: string;
	interior: string;
	exterior: string;
	border: string;
	borderSubtle: string;
	text: string;
	textSubtle: string;
	primary: string;
};

export const palettes: Record<
	(typeof ThemeUtils.themes)[number],
	ColorPalette
> = {
	dark: [
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
	],
	light: [
		"#1a1b22", // [0]  deepest
		"#35373e", // [1]
		"#636570", // [2]
		"#858790", // [3]
		"#A2A4AD", // [4]
		"#C4C6CF", // [5]  near-black text — very slightly cool
		"#E8E9F0", // [6]  subtle borders
		"#F5F5F5", // [7]  surface / card background
		"#FAFAFA", // [8]  body / AppShell background
		"#FFFFFF", // [9]  pure white
	],
} as const;

export interface ThemeContext {
	colorPalette: ColorPalette;
	colorScheme: ColorScheme;
}

const build = (theme: (typeof ThemeUtils.themes)[number]): ThemeContext => {
	return {
		colorPalette: palettes[theme],
		colorScheme: {
			surface: palettes[theme][6],
			interior: palettes[theme][7],
			exterior: palettes[theme][8],
			border: palettes[theme][4],
			borderSubtle: palettes[theme][5],
			text: palettes[theme][0],
			textSubtle: palettes[theme][2],
			primary: "#1194ff",
		},
	};
};

export const ThemeContext = createContext<ThemeContext>(build("dark"));

export default function ThemeContextProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { theme } = useThemes();

	return createElement(ThemeContext, { value: build(theme) }, children);
}
