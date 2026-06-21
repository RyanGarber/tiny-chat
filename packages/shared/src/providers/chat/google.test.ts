import type { zContextItem, zGenerateOutput } from '../../types/chat.ts';
import type { ModelMessage, ObjectStreamPart, TextStreamPart } from 'ai';
import { Author } from '../../../../backend/generated/prisma/enums.ts';
import { expect, test } from 'vitest';
import { fromSdkContent, toSdkContext } from './index.ts';
import { zUser } from '../../types/user.ts';
import { GoogleProvider } from './google.ts';
import { AntigravityProvider } from './antigravity.ts';

const USER: zUser = { id: '1', name: 'Test User', settings: {}, isEphemeral: false };

const TO: [zContextItem[], ModelMessage[]][] = [
  [
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
        config: null,
        createdAt: null,
      },
    ],
    [
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
  ],
  [
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
    ],
    [
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
  ],
  [
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
        config: null,
        createdAt: null,
      },
    ],
    [
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
  ],
  [
    [
      {
        id: 'id',
        author: Author.USER,
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
        config: null,
        createdAt: null,
      },
    ],
    [
      {
        role: 'user',
        content: [],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'id',
            toolName: 'name',
            output: {
              type: 'content',
              value: [
                {
                  type: 'text',
                  text: '[Unsupported file: ]',
                },
                {
                  type: 'image-data',
                  mediaType: 'image/png',
                  data: '',
                },
              ],
            },
            providerOptions: undefined,
          },
        ],
      },
    ],
  ],
];

test.each(TO)('Google - toSdkContext - %#', (from, to) => {
  expect(
    toSdkContext(
      USER,
      { provider: 'google', model: 'gemini-3-flash', args: {}, toolGroups: [], skills: [] },
      GoogleProvider,
      from,
    ),
  ).toEqual(to);
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

test.each(FROM)('Google - fromSdkContent - %#', (event, to) => {
  expect(
    fromSdkContent(
      USER,
      { provider: 'google', model: 'gemini-3-flash', args: {}, toolGroups: [], skills: [] },
      GoogleProvider,
      event,
    ),
  ).toEqual(to);
});

const ARGS = [
  [AntigravityProvider, 'gemini-3-flash', GoogleProvider.getModelArgs('gemini-3-flash')],
] as const;

test.each(ARGS)('Google - getModelArgs - %#', (provider, model, args) => {
  expect(provider.getModelArgs(model)).toEqual(args);
});
