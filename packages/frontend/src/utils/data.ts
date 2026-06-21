import type { ReactNode } from 'react';
import { Children, createContext, isValidElement } from 'react';
import type { SearchResult } from '@tiny-chat/shared/src/providers/web';
import type { useMemories } from '@/features/chat/hooks/useMemories.ts';
import type { useActions } from '@/features/chat/hooks/useActions.ts';
import type { MessageState } from '@tiny-chat/shared/src/types/chat.ts';

export const NOOP_MARKER = '\uE001';
export const CODE_MARKER = '\uE002';
export const WRITING_MARKER = '\uE003';
export const DIFF_MARKER = '\uE004';

export interface MarkdownContext {
  webSearchResults: SearchResult[];
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

export function getTextFromChildren(children: ReactNode): string {
  let text = '';
  Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      text += child;
    } else if (isValidElement(child)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      text += getTextFromChildren((child.props as any).children);
    } else if (Array.isArray(child)) {
      text += getTextFromChildren(child);
    }
  });
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
}

export function takeStringOutOfNodeAndChildren(node: ReactNode, str: string): ReactNode {
  if (typeof node === 'string') {
    return node.split(str).join('');
  }
  if (isValidElement(node)) {
    return {
      ...node,
      props: {
        // @ts-expect-error unknown
        ...node.props,
        // @ts-expect-error unknown
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        children: takeStringOutOfNodeAndChildren(node.props.children, str),
      },
    };
  }
  if (Array.isArray(node)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return node.map((child) => takeStringOutOfNodeAndChildren(child, str));
  }
  return node;
}

export function isMissingToolResult(message: MessageState) {
  const parts = message.data.flat();
  const toolCallCount = parts.filter((p) => p.type === 'toolCall').length;
  const toolResultCount = parts.filter((p) => p.type === 'toolResult').length;
  return toolResultCount < toolCallCount;
}
