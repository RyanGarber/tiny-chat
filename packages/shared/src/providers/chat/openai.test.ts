import { zUser } from '../../types/user.ts';
import { fromSdkContent, toSdkContext } from './index.ts';
import { Author, zContextItem, zGenerateOutput } from '../../types/chat.ts';
import { OpenAIProvider } from './openai.ts';
import { expect, test } from 'vitest';
import { ModelMessage, ObjectStreamPart, TextStreamPart } from 'ai';
import { AzureProvider } from './azure.ts';

const USER: zUser = { id: '1', name: 'Test User', settings: {}, isEphemeral: false };

const TO: [zContextItem, ModelMessage][] = [
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
      config: null,
      createdAt: null,
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
      config: null,
      createdAt: null,
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

test.each(TO)('OpenAI - toSdkContext - %#', (from, to) => {
  expect(
    toSdkContext(
      USER,
      { provider: 'openai', model: 'gpt-5-chat', args: {}, toolGroups: [], skills: [] },
      OpenAIProvider,
      [from],
    ),
  ).toEqual([to]);
});

const FROM: [TextStreamPart<any> | ObjectStreamPart<any>, zGenerateOutput][] = [
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

test.each(FROM)('OpenAI - fromSdkContent - %#', (event, to) => {
  expect(
    fromSdkContent(
      USER,
      { provider: 'openai', model: 'gpt-5-chat', args: {}, toolGroups: [], skills: [] },
      OpenAIProvider,
      event,
    ),
  ).toEqual(to);
});

const ARGS = [
  [AzureProvider, 'gpt-5-chat', OpenAIProvider.getModelArgs('gpt-5-chat')],
  [OpenAIProvider, 'gpt-5-chat', OpenAIProvider.getModelArgs('gpt-5-chat')],
] as const;

test.each(ARGS)('OpenAI - getModelArgs - %#', (provider, model, args) => {
  expect(provider.getModelArgs(model)).toEqual(args);
});
