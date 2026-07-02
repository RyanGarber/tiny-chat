import { describe, expect, inject, it } from 'vitest';
import { TextStreamPart } from 'ai';
import { AntigravityProvider } from './antigravity.ts';
import { zDataPart } from '../../types/chat.ts';
import { testConfig } from '../../tests.ts';

describe('providers - antigravity', () => {
  it('stores signatures', () => {
    const part: TextStreamPart<any> = {
      type: 'tool-call',
      toolCallId: '',
      toolName: '',
      input: {},
      providerMetadata: {
        'antigravity-proxy': {
          thoughtSignature: '__TEST__',
        },
      },
    };

    const signature = AntigravityProvider.getPartSignature?.(
      inject('shared_user'),
      testConfig(AntigravityProvider, 'gemini-3-flash'),
      part,
    );
    expect(signature?.model).toBe('gemini-3-flash');
    expect(signature?.reasoning).toBe('__TEST__');
  });

  it('returns matching signatures', () => {
    const part: zDataPart = {
      type: 'toolCall',
      id: '',
      name: '',
      args: {},
      signature: {
        model: 'gemini-3-flash',
        reasoning: '__TEST__',
      },
    };

    const metadata = AntigravityProvider.getPartSignatureReturn?.(
      inject('shared_user'),
      testConfig(AntigravityProvider, 'gemini-3-flash'),
      part,
    );
    expect(metadata?.['antigravity-proxy']?.thoughtSignature).toBe('__TEST__');

    const metadata2 = AntigravityProvider.getPartSignatureReturn?.(
      inject('shared_user'),
      testConfig(AntigravityProvider, 'gemini-3-pro'),
      part,
    );
    expect(metadata2?.['antigravity-proxy']?.thoughtSignature).toBe(
      'skip_thought_signature_validator',
    );
  });
});
