import { createContext } from "react";
import type { ActionState } from "#shared/features/data/types/action.ts";
import type { MemoryState } from "#shared/features/data/types/memory.ts";
import type { MessageState } from "#shared/features/data/types/message.ts";
import type { zWebContext } from "#shared/features/provider/types/web.ts";

export interface MarkdownContext {
	webReferences: zWebContext[];
	memoryReferences: MemoryState[];
	actionReferences: ActionState[];
	isGenerating: boolean;
}

export const MarkdownContext = createContext<MarkdownContext>({
	webReferences: [],
	memoryReferences: [],
	actionReferences: [],
	isGenerating: false,
});

export function isMissingToolResult(message: MessageState) {
	const parts = message.data.flat();
	const toolCallCount = parts.filter((p) => p.type === "toolCall").length;
	const toolResultCount = parts.filter((p) => p.type === "toolResult").length;
	return toolResultCount < toolCallCount;
}
