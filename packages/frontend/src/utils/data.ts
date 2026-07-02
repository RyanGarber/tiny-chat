import { createContext } from 'react';
import type { useMemories } from '@/features/chat/hooks/useMemories.ts';
import type { useActions } from '@/features/chat/hooks/useActions.ts';
import type { MessageState } from '@tiny-chat/shared/src/types/chat.ts';
import type { zSearchWebOutput } from '@tiny-chat/backend/src/tools/web.ts';

export const DIFF_MARKER = '\uE001';

export interface MarkdownContext {
  webSearchResults: zSearchWebOutput;
  memories: NonNullable<ReturnType<typeof useMemories>['data']>;
  actions: NonNullable<ReturnType<typeof useActions>['data']>;
  isGenerating: boolean;
}
export const MarkdownContext = createContext<MarkdownContext>({
  webSearchResults: [],
  memories: [],
  actions: [],
  isGenerating: false,
});

export const hashText = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

export function isMissingToolResult(message: MessageState) {
  const parts = message.data.flat();
  const toolCallCount = parts.filter((p) => p.type === 'toolCall').length;
  const toolResultCount = parts.filter((p) => p.type === 'toolResult').length;
  return toolResultCount < toolCallCount;
}
