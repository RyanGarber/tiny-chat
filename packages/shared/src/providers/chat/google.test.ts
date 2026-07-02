import type { zContextItem, zDataPart } from '../../types/chat.ts';
import type { TextStreamPart } from 'ai';
import { describe, expect, inject, it } from 'vitest';
import { toSdkContext } from './index.ts';
import { GoogleProvider } from './google.ts';
import { testConfig } from '../../tests.ts';

describe('providers - google', () => {
  it('stores signatures', () => {
    const part: TextStreamPart<any> = {
      type: 'reasoning-delta',
      id: '',
      text: '',
      providerMetadata: {
        google: {
          thoughtSignature: '__TEST__',
        },
      },
    };
    const signature = GoogleProvider.getPartSignature?.(
      inject('shared_user'),
      testConfig(GoogleProvider, 'gemini-3-flash'),
      part,
    );
    expect(signature?.model).toBe('gemini-3-flash');
    expect(signature?.reasoning).toBe('__TEST__');
  });

  it('returns matching signatures', () => {
    const part: zDataPart = {
      type: 'thought',
      id: '',
      value: '',
      signature: {
        model: 'gemini-3-flash',
        reasoning: '__TEST__',
      },
    };

    const metadata = GoogleProvider.getPartSignatureReturn?.(
      inject('shared_user'),
      testConfig(GoogleProvider, 'gemini-3-flash'),
      part,
    );
    expect(metadata?.google?.thoughtSignature).toBe('__TEST__');

    const metadata2 = GoogleProvider.getPartSignatureReturn?.(
      inject('shared_user'),
      testConfig(GoogleProvider, 'gemini-3-pro'),
      part,
    );
    expect(metadata2?.google?.thoughtSignature).toBe('skip_thought_signature_validator');
  });

  it('transforms youtube links to video parts', () => {
    const part: zDataPart = {
      type: 'text',
      value: 'content: https://www.youtube.com/watch?v=___________',
    };
    const transformed = GoogleProvider.getPartTransformed?.(
      inject('shared_user'),
      testConfig(GoogleProvider, 'gemini-3-flash'),
      part,
    );
    expect.assert(transformed?.[1].type === 'file');
    expect(transformed?.[1].mime).toBe('video/mp4');
    expect(transformed?.[1].data).toBe('https://www.youtube.com/watch?v=___________');
  });

  it('preserves multimodal tool results', () => {
    const message: zContextItem = {
      author: 'USER',
      id: null,
      data: [
        [
          {
            type: 'toolResult',
            id: 'id',
            name: 'name',
            value: [
              {
                type: 'file',
                name: 'file.exe',
                mime: 'application/octet-stream',
                data: '',
              },
              {
                type: 'file',
                name: 'file.png',
                mime: 'image/png',
                data: '',
              },
            ],
          },
        ],
      ],
      config: { ...inject('shared_config'), model: 'gemini-3-flash' },
      createdAt: null,
    };
    const transformed = toSdkContext(
      inject('shared_user'),
      testConfig(GoogleProvider, 'gemini-3-flash'),
      GoogleProvider,
      [message],
    );
    expect.assert(Array.isArray(transformed[1].content));
    expect.assert(transformed[1].content[0].type === 'tool-result');
    expect.assert(transformed[1].content[0].output.type === 'content');

    const content = transformed[1].content[0].output.value;

    expect.assert(content[0].type === 'text');
    expect(content[0].text).toContain('Unsupported');

    expect.assert(content[1].type === 'image-data');
    expect(content[1].mediaType).toBe('image/png');
  });
});
