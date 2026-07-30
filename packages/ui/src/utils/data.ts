import { createContext } from "react";
import type { ActionState } from "#core/features/data/types/action.ts";
import type { MemoryState } from "#core/features/data/types/memory.ts";
import type { MessageState } from "#core/features/data/types/message.ts";
import type { FileNode } from "#core/features/file/types/file.ts";
import type { zWebContext } from "#core/features/provider/types/web.ts";

export interface MarkdownContext {
	webReferences: zWebContext[];
	memoryReferences: MemoryState[];
	actionReferences: ActionState[];
	fileReferences: FileNode[];
	isGenerating: boolean;
}

export const MarkdownContext = createContext<MarkdownContext>({
	webReferences: [],
	memoryReferences: [],
	actionReferences: [],
	fileReferences: [],
	isGenerating: false,
});

export function isMissingToolResult(message: MessageState) {
	const parts = message.data.flat();
	const toolCallCount = parts.filter((p) => p.type === "toolCall").length;
	const toolResultCount = parts.filter((p) => p.type === "toolResult").length;
	return toolResultCount < toolCallCount;
}
