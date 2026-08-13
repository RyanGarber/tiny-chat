import { mermaid as _mermaid, type MermaidInstance } from "@streamdown/mermaid";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
import { useMemo } from "react";

export const useMermaid = () => {
	const { theme } = useThemes();

	const mermaid = useMemo((): MermaidInstance => {
		return _mermaid.getMermaid({
			theme: theme === "dark" ? "dark" : "neutral",
		});
	}, [theme]);

	return { mermaid };
};
