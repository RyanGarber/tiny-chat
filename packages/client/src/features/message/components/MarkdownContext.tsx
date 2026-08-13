import type { ThemeUtils } from "@tiny-chat/core/src/core/utils/ThemeUtils.ts";
import type { ActionState } from "@tiny-chat/core/src/features/data/types/action.ts";
import type { MemoryState } from "@tiny-chat/core/src/features/data/types/memory.ts";
import type { FileNode } from "@tiny-chat/core/src/features/file/types/file.ts";
import type { zWebContext } from "@tiny-chat/core/src/features/provider/types/web.ts";
import { createContext } from "react";

export type MarkdownSource = { key: string } & (
	| {
			type: "web";
			value: zWebContext;
	  }
	| { type: "memory"; value: MemoryState }
	| { type: "action"; value: ActionState }
	| { type: "file"; value: FileNode }
);

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
