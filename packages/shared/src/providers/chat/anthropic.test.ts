import { describe, expect, inject, it } from 'vitest';
import { TextStreamPart } from 'ai';
import { AnthropicProvider } from './anthropic.ts';
import { zDataPart } from '../../types/chat.ts';
import { testConfig } from '../../tests.ts';

describe('providers - anthropic', () => {
  it('stores signatures', () => {
    const part: TextStreamPart<any> = {
      type: 'reasoning-delta',
      id: '',
      text: '',
      providerMetadata: {
        anthropic: {
          signature: '__TEST__',
        },
      },
    };

    const signature = AnthropicProvider.getPartSignature?.(
      inject('shared_user'),
      testConfig(AnthropicProvider, 'claude-sonnet-5'),
      part,
    );
    expect(signature?.model).toBe('claude-sonnet-5');
    expect(signature?.reasoning).toBe('__TEST__');
  });

  it('returns matching signatures', () => {
    const part: zDataPart = {
      type: 'thought',
      id: '',
      value: '',
      signature: {
        model: 'claude-sonnet-5',
        reasoning: '__TEST__',
      },
    };

    const metadata = AnthropicProvider.getPartSignatureReturn?.(
      inject('shared_user'),
      testConfig(AnthropicProvider, 'claude-sonnet-5'),
      part,
    );
    expect(metadata?.anthropic?.signature).toBe('__TEST__');

    const metadata2 = AnthropicProvider.getPartSignatureReturn?.(
      inject('shared_user'),
      testConfig(AnthropicProvider, 'claude-sonnet-4'),
      part,
    );
    expect(metadata2?.anthropic?.signature).toBeUndefined();
  });
});
