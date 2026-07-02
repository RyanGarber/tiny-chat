import { useMessagingStore } from '@/features/chat/stores/useMessagingStore';
import { BaseElement, BaseText, Descendant, Text } from 'slate';

export function serializeElement(element: BaseElement): string | null {
  if (element.hidden) return null;
  switch (element.type) {
    case 'quote': {
      const model = (element as unknown as { model: string }).model as string | undefined;
      return `:::quote{model=${model}}\n${(element.children[0] as BaseText).text}\n:::`;
    }
    default:
      return element.children
        .map((child) => {
          if (Text.isText(child)) return child.text;
          else return serializeElement(child);
        })
        .join('');
  }
}

export function serialize(): string {
  return (
    useMessagingStore
      .getState()
      .editor?.children.map((node) => serializeElement(node as BaseElement)) ?? []
  )
    .filter((line) => line !== null)
    .join('\n');
}

const QUOTE_OPEN = /^:::quote\{model=(.*)\}$/;
const QUOTE_CLOSE = ':::';

export function deserialize(md: string): Descendant[] {
  const lines = md.split('\n');
  const nodes: Descendant[] = [];

  let quoteModel: string | null = null;
  let quoteLines: string[] = [];

  const pushQuote = () => {
    nodes.push({
      type: 'quote',
      model: quoteModel,
      children: [{ text: quoteLines.join('\n') }],
    } as Descendant & { model: string });
    quoteModel = null;
    quoteLines = [];
  };

  for (const line of lines) {
    if (quoteModel !== null) {
      if (line === QUOTE_CLOSE) pushQuote();
      else quoteLines.push(line);
      continue;
    }

    const match = QUOTE_OPEN.exec(line);
    if (match) {
      quoteModel = match[1];
      continue;
    }

    nodes.push({
      type: 'paragraph',
      children: [{ text: line }],
    });
  }

  if (quoteModel !== null) pushQuote();

  return nodes;
}
