import { expect, test } from 'vitest';
import {
  Author,
  type ModelArg,
  type zContextItem,
  type zGenerateOutput,
} from '../../types/chat.ts';
import { zUser } from '../../types/user.ts';
import { toSdkContext, fromSdkContent, type ChatProvider } from './index.ts';
import type { ModelMessage, ObjectStreamPart, TextStreamPart } from 'ai';
import { OpenAIProvider } from './openai.ts';
import { GoogleProvider } from './google.ts';
import { GeminiProvider } from './gemini.ts';
import { AnthropicProvider } from './anthropic.ts';
import { AzureProvider } from './azure.ts';
import { AWSProvider } from './aws.ts';

const USER: zUser = { id: '1', settings: {} };
const TO_GEMINI: [zContextItem, ModelMessage][] = [
  [
    {
      id: 'id',
      author: Author.USER,
      data: [
        [
          {
            type: 'text',
            value: 'content: https://www.youtube.com/watch?v=___________',
          },
        ],
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'content: ',
          providerOptions: undefined,
        },
        {
          type: 'file',
          data: 'https://www.youtube.com/watch?v=___________',
          mediaType: 'video/mp4',
          filename: undefined,
          providerOptions: undefined,
        },
      ],
    },
  ],
  [
    {
      id: 'id',
      author: Author.MODEL,
      data: [
        [
          {
            type: 'thought',
            value: 'content',
            signature: { model: 'gemini-3-flash', reasoning: 'thought_signature' },
          },
        ],
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'reasoning',
          text: 'content',
          providerOptions: { google: { thoughtSignature: 'thought_signature' } },
        },
      ],
    },
  ],
  [
    {
      id: 'id',
      author: Author.MODEL,
      data: [
        [
          {
            type: 'thought',
            value: 'content',
            signature: { model: 'gpt-5-chat', reasoning: 'thought_signature' },
          },
        ],
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'reasoning',
          text: 'content',
          providerOptions: { google: { thoughtSignature: 'skip_thought_signature_validator' } },
        },
      ],
    },
  ],
];

test.each(TO_GEMINI)('Google - toSdkContext - %#', (from, to) => {
  expect(
    toSdkContext(USER, { provider: 'google', model: 'gemini-3-flash', args: {} }, GoogleProvider, [
      from,
    ]),
  ).toEqual([to]);
});

const TO_OPENAI: [zContextItem, ModelMessage][] = [
  [
    {
      id: 'id',
      author: Author.MODEL,
      data: [
        [
          {
            type: 'thought',
            value: 'content',
            signature: { model: 'gemini-3-flash', reasoning: 'thought_signature' },
          },
        ],
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'reasoning',
          text: 'content',
          providerOptions: undefined,
        },
      ],
    },
  ],
  [
    {
      id: 'id',
      author: Author.MODEL,
      data: [
        [
          {
            type: 'thought',
            value: 'content',
            signature: {
              model: 'gpt-5-chat',
              item: 'item_id',
              reasoning: 'reasoning.encrypted_content',
            },
          },
        ],
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'reasoning',
          text: 'content',
          providerOptions: {
            openai: { itemId: 'item_id', reasoningEncryptedContent: 'reasoning.encrypted_content' },
          },
        },
      ],
    },
  ],
];

test.each(TO_OPENAI)('OpenAI - toSdkContext - %#', (from, to) => {
  expect(
    toSdkContext(USER, { provider: 'openai', model: 'gpt-5-chat', args: {} }, OpenAIProvider, [
      from,
    ]),
  ).toEqual([to]);
});

const FROM_GOOGLE: [TextStreamPart<any> | ObjectStreamPart<any>, zGenerateOutput][] = [
  [
    {
      type: 'reasoning-delta',
      id: 'id',
      text: 'content',
      providerMetadata: { google: { thoughtSignature: 'thought_signature' } },
    },
    {
      type: 'data',
      value: {
        type: 'thought',
        id: 'id',
        value: 'content',
        signature: { model: 'gemini-3-flash', reasoning: 'thought_signature' },
      },
    },
  ],
  [
    {
      type: 'reasoning-delta',
      id: 'id',
      text: 'content',
      providerMetadata: {
        openai: { itemId: 'item_id', reasoningEncryptedContent: 'reasoning.encrypted_content' },
      },
    },
    {
      type: 'data',
      value: {
        type: 'thought',
        id: 'id',
        value: 'content',
        signature: undefined,
      },
    },
  ],
];

test.each(FROM_GOOGLE)('Google - fromSdkContent - %#', (event, to) => {
  expect(
    fromSdkContent(
      USER,
      { provider: 'google', model: 'gemini-3-flash', args: {} },
      GoogleProvider,
      event,
    ),
  ).toEqual(to);
});

const FROM_OPENAI: [TextStreamPart<any> | ObjectStreamPart<any>, zGenerateOutput][] = [
  [
    {
      type: 'reasoning-delta',
      id: 'id',
      text: 'content',
      providerMetadata: { google: { thoughtSignature: 'thought_signature' } },
    },
    {
      type: 'data',
      value: {
        type: 'thought',
        id: 'id',
        value: 'content',
        signature: undefined,
      },
    },
  ],
  [
    {
      type: 'reasoning-delta',
      id: 'id',
      text: 'content',
      providerMetadata: {
        openai: { itemId: 'item_id', reasoningEncryptedContent: 'reasoning.encrypted_content' },
      },
    },
    {
      type: 'data',
      value: {
        type: 'thought',
        id: 'id',
        value: 'content',
        signature: {
          model: 'gpt-5-chat',
          item: 'item_id',
          reasoning: 'reasoning.encrypted_content',
        },
      },
    },
  ],
];

test.each(FROM_OPENAI)('OpenAI - fromSdkContent - %#', (event, to) => {
  expect(
    fromSdkContent(
      USER,
      { provider: 'openai', model: 'gpt-5-chat', args: {} },
      OpenAIProvider,
      event,
    ),
  ).toEqual(to);
});

const ARGS: [ChatProvider, string, ModelArg[]][] = [
  [AWSProvider, 'claude-4-5-haiku', AnthropicProvider.getModelArgs('claude-4-5-haiku')],
  [AWSProvider, 'nova-4-flash', AWSProvider.getModelArgs('nova-4-flash')],
  [AzureProvider, 'gpt-5-chat', OpenAIProvider.getModelArgs('gpt-5-chat')],
  [AzureProvider, 'claude-4-5-haiku', AnthropicProvider.getModelArgs('claude-4-5-haiku')],
  [GeminiProvider, 'gemini-3-flash', GeminiProvider.getModelArgs('gemini-3-flash')],
  [OpenAIProvider, 'gpt-5-chat', OpenAIProvider.getModelArgs('gpt-5-chat')],
];

test.each(ARGS)('getModelArgs[%#]', (provider, model, args) => {
  expect(provider.getModelArgs(model)).toEqual(args);
});
