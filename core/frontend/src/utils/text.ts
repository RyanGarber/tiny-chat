import { Children, createContext, isValidElement, ReactNode } from 'react';
import { normalizeText, zData } from '@tiny-chat/core-backend/src/types.ts';
import { SearchResult } from '@tiny-chat/core-backend/src/providers/web';

export const STREAMING_MARKER = '\uE000';
export const MATH_MARKER = '\uE001';
export const CODE_MARKER = '\uE002';
export const WRITING_MARKER = '\uE003';

export const MarkdownContext = createContext<{ webSearchResults: SearchResult[] }>({
  webSearchResults: [],
});

export const hashText = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

// TODO - added 'hidden' field for file heading; moved to onSend... will we want to keep it?
export function extractText(data: zData, includeHidden = false) {
  const textParts: string[] = [];
  for (const part of data) {
    if (part.type === 'text' && (includeHidden || !part.hidden)) {
      textParts.push(part.value);
    }
  }
  return textParts.join('\n'); // TODO - newlines?
}

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
