import type { ThemeUtils } from "@tiny-chat/core/src/core/utils/ThemeUtils.ts";
import { createContext } from "react";

/**
 * Note that `sources` is deliberately absent: it changes whenever any of the
 * chat-scoped queries settle, and carrying it here made every markdown tree in
 * the list re-render for it. The one component that needs it — the citation
 * pill — reads it from `useMessageStore` at the point of use instead.
 */
export interface MarkdownContext<
	TSize extends string | number = string | number,
	TColor extends string = string,
> {
	theme?: (typeof ThemeUtils.themes)[number];
	codeTheme?: (typeof ThemeUtils.codeThemes)[number];
	streaming?: boolean;
	style?: { textSize?: TSize; textColor?: TColor };
}

export const MarkdownContext = createContext<MarkdownContext>({});
