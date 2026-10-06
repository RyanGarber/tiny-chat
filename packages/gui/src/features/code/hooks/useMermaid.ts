import { mermaid as _mermaid, type MermaidInstance } from "@streamdown/mermaid";
import { useMemo } from "react";
import { useThemes } from "#client/features/settings/hooks/useThemes.ts";

export const useMermaid = () => {
	const { theme } = useThemes();

	const mermaid = useMemo((): MermaidInstance => {
		return _mermaid.getMermaid({
			theme: theme === "dark" ? "dark" : "neutral",
		});
	}, [theme]);

	return { mermaid };
};
