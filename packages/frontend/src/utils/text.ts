import { Children, createContext, isValidElement, ReactNode } from 'react';
import { normalizeText } from '@tiny-chat/shared/src/utils.ts';
import { SearchResult } from '@tiny-chat/shared/src/providers/web';
import type { useMemories } from '@/features/chat/hooks/useMemories.ts';
import type { useActions } from '@/features/chat/hooks/useActions.ts';

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
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

export function scrubText(text: string, maxLength = -1): string {
  text = normalizeText(text)
    .replace(/::model=[^:]+::/g, '') // Remove quote model tags
    .replace(/::>::\s?(.*)/g, '$1') // Remove quote markers
    .replace(/!\[.*?]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)]\((.*?)\)/g, '$1') // Remove links but keep text
    .replace(/(`{1,3})(.*?)\1/g, '$2') // Remove inline code and code blocks
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
    .replace(/([*_])(.*?)\1/g, '$2') // Remove italics
    .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
    .replace(/#+\s?(.*)/g, '$1') // Remove headings
    .replace(/>\s?(.*)/g, '$1') // Remove blockquotes
    .replace(/-\s?(.*)/g, '$1') // Remove unordered list markers
    .replace(/\d+\.\s?(.*)/g, '$1') // Remove ordered list markers
    .replace(/\n/g, ' ') // Replace multiple newlines with a single newline
    .trim();
  if (maxLength > 0 && text.length > maxLength) {
    return text.substring(0, maxLength) + '...';
  }
  return text;
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
