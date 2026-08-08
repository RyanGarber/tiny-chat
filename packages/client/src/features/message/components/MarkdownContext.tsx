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

export interface MarkdownContext<
	TSize extends string | number = string | number,
	TColor extends string = string,
> {
	sources?: MarkdownSource[];
	streaming?: boolean;
	style?: { textSize?: TSize; textColor?: TColor };
}

export const MarkdownContext = createContext<MarkdownContext>({});
