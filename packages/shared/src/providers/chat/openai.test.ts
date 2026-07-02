import { zDataPart } from '../../types/chat.ts';
import { OpenAIProvider } from './openai.ts';
import { describe, expect, inject, it } from 'vitest';
import { TextStreamPart } from 'ai';
import { testConfig } from '../../tests.ts';

describe('providers - openai', () => {
  it('stores signatures', () => {
    const part: TextStreamPart<any> = {
      type: 'reasoning-delta',
      id: '',
      text: '',
      providerMetadata: {
        openai: {
          itemId: '__TEST__',
          reasoningEncryptedContent: '__TEST__',
        },
      },
    };
    const signature = OpenAIProvider.getPartSignature?.(
      inject('shared_user'),
      testConfig(OpenAIProvider, 'gpt-5'),
      part,
    );
    expect(signature?.model).toBe('gpt-5');
    expect(signature?.item).toBe('__TEST__');
    expect(signature?.reasoning).toBe('__TEST__');
  });

  it('returns matching signatures', () => {
    const part: zDataPart = {
      type: 'thought',
      id: '',
      value: '',
      signature: {
        model: 'gpt-5',
        item: '__TEST__',
        reasoning: '__TEST__',
      },
    };

    const metadata = OpenAIProvider.getPartSignatureReturn?.(
      inject('shared_user'),
      testConfig(OpenAIProvider, 'gpt-5'),
      part,
    );
    expect(metadata?.openai?.itemId).toBe('__TEST__');
    expect(metadata?.openai?.reasoningEncryptedContent).toBe('__TEST__');

    const metadata2 = OpenAIProvider.getPartSignatureReturn?.(
      inject('shared_user'),
      testConfig(OpenAIProvider, 'gpt-4'),
      part,
    );
    expect(metadata2?.openai?.itemId).toBe('__TEST__');
    expect(metadata2?.openai?.reasoningEncryptedContent).toBeUndefined();
  });
});
