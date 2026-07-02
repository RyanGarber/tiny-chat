import { describe, expect, it } from 'vitest';
import { deserialize, serializeElement } from '@/features/slate/serializer.tsx';
import { BaseElement } from 'slate';

describe('slate - serializer', () => {
  it('serializes a quote', () => {
    const quoteText = ':::quote{model=gpt-5.5}\ntest\n:::';

    const text = serializeElement({
      type: 'quote',
      model: 'gpt-5.5',
      children: [{ text: 'test' }],
    } as BaseElement & { model: string });
    expect(text).toBe(quoteText);

    const element = deserialize(quoteText);
    expect((element[0] as { type: string }).type).toBe('quote');
    expect((element[0] as unknown as { model: string }).model).toBe('gpt-5.5');
  });
});
