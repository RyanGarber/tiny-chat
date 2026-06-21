import type {
  EmbeddingModel,
  FilePart,
  ImagePart,
  LanguageModel,
  ModelMessage,
  ObjectStreamPart,
  Provider,
  TextPart,
  TextStreamPart,
  Tool as AISdkTool,
  ToolCallPart,
  ToolResultPart,
} from 'ai';
import { embedMany, streamText } from 'ai';

import {
  type Model,
  type ModelArg,
  type zConfig,
  type zContextItem,
  zData,
  type zDataPart,
  type zGenerateOutput,
  type zSignature,
  zToolResultValue,
} from '../../types/chat.ts';
import type { zUser } from '../../types/user.ts';
import type { BaseProvider } from '../index.ts';
import { GoogleProvider } from './google.ts';
import { AnthropicProvider } from './anthropic.ts';
import { OpenAIProvider } from './openai.ts';
import { AzureProvider } from './azure.ts';
import { AWSProvider } from './aws.ts';
import { CustomProvider } from './custom.ts';
import type { JSONType } from 'zod';
import { z } from 'zod';
import { AntigravityProvider } from './antigravity.ts';
import type { Tool } from '../../types/tool.ts';
import { TestProvider } from './test.ts';
import type { Env } from '../../types/env.ts';
import { VoyageProvider } from './voyage.ts';
import { getBaseModelTransform } from '../../utils.ts';

export interface ChatProvider extends BaseProvider {
  name: string;
  settings: string[];
  getModels: (user: zUser) => Promise<Model[]>;
  getModelArgs: (model: string) => ModelArg[];

  getClient: (user: zUser, env: Env) => Partial<Provider> | null;
  getClientGenerateModel: (user: zUser, id: string, env: Env) => LanguageModel | null;
  getClientEmbedModel: (user: zUser, id: string, env: Env) => EmbeddingModel | null;
  getClientOptions: (user: zUser, config: zConfig, env: Env) => Record<string, any> | undefined;

  getPartTransformed?: (
    user: zUser,
    config: zConfig,
    message: zContextItem,
    part: zDataPart,
  ) => zDataPart[];
  getPartSignature?: (
    user: zUser,
    config: zConfig,
    part: TextStreamPart<any> | ObjectStreamPart<any>,
  ) => zSignature | undefined;
  getPartSignatureReturn?: (
    user: zUser,
    config: zConfig,
    message: zContextItem,
    part: zDataPart,
  ) => Record<string, any> | undefined;
}

export const chatProviders: ChatProvider[] = [
  AnthropicProvider,
  AWSProvider,
  AzureProvider,
  CustomProvider,
  AntigravityProvider,
  GoogleProvider,
  OpenAIProvider,
  VoyageProvider,
  TestProvider,
];

export type StreamTextOptions = Omit<
  Parameters<typeof streamText>[0],
  'model' | 'prompt' | 'tools' | 'messages' | 'providerOptions' | 'tempurature' | 'maxOutputTokens'
>;

export async function* runGeneration(
  user: zUser,
  provider: ChatProvider,
  context: zContextItem[],
  config: zConfig,
  tools: Tool<any, any, any>[],
  env: Env,
  options: Partial<StreamTextOptions> = {},
): AsyncGenerator<zGenerateOutput> {
  const clientModel = provider.getClientGenerateModel(user, config.model, env);
  const providerModels = await provider.getModels(user);
  const supportsToolCall = providerModels.find((m) => m.name === config.model);
  if (!clientModel) throw new Error(`Model not available: ${config.model}`);

  config = prepareConfig(config, provider.getModelArgs(config.model));

  const sdkData: (TextStreamPart<any> | ObjectStreamPart<any>)[] = [];

  console.log(`[provider] original context:`, context);

  const stream = streamText({
    ...options,
    model: clientModel,
    maxOutputTokens: config.args?.['max-tokens'],
    temperature: config.args?.temperature as number,
    providerOptions: provider?.getClientOptions(user, config, env),
    tools: supportsToolCall
      ? Object.fromEntries(
          tools.map((tool) => [
            tool.name,
            {
              description: tool.description,
              inputSchema: z.fromJSONSchema(tool.input as never),
            } satisfies AISdkTool,
          ]),
        )
      : undefined,
    messages: toSdkContext(user, config, provider, context),
  });

  for await (const event of stream.fullStream) {
    sdkData.push(event);

    if (event.type === 'start-step') {
      yield {
        type: 'start',
        warnings: event.warnings,
      };
    }

    const part = fromSdkContent(user, config, provider, event);
    if (part) yield part;

    if (event.type === 'finish' || event.type === 'error') {
      yield {
        type: 'end',
        metadata: sdkData,
      };
    }
  }
}

export function toSdkContext(
  user: zUser,
  config: zConfig,
  provider: ChatProvider,
  context: zContextItem[],
) {
  const sdkMessages: ModelMessage[] = [];
  for (const original of context) {
    const message: ModelMessage = {
      role: original.author === 'MODEL' ? 'assistant' : 'user',
      content: [],
    };

    const transform = (part: zDataPart) =>
      provider.getPartTransformed?.(user, config, original, part) ?? getBaseModelTransform(part);
    const parts = zData.parse(original.data).flat().flatMap(transform);

    for (const part of parts) {
      const isToolResult = part.type === 'toolResult';
      const isToolRole = message.role === 'tool';

      // If transitioning between toolResult and non-toolResult blocks, push and reset
      if ((isToolResult && !isToolRole) || (!isToolResult && isToolRole)) {
        sdkMessages.push({ ...message });
        message.content = [];
      }

      // Correctly assign the author for the current block
      message.role = isToolResult ? 'tool' : original.author === 'MODEL' ? 'assistant' : 'user';

      let providerOptions = provider.getPartSignatureReturn?.(user, config, original, part);
      providerOptions = cleanSignatureReturn(providerOptions);

      const toSdkPart = (
        part: zDataPart,
      ): (
        | TextPart
        | ImagePart
        | (Omit<TextPart, 'type'> & { type: 'reasoning' })
        | ToolCallPart
        | ToolResultPart
        | FilePart
      )[] => {
        if (part.type === 'text') {
          return [{ type: 'text', text: part.value, providerOptions }];
        } else if (part.type === 'file') {
          if (part.mime.startsWith('image/')) {
            return [{ type: 'image', mediaType: part.mime, image: part.data, providerOptions }];
          } else {
            return [
              {
                type: 'file',
                filename: part.name,
                mediaType: part.mime,
                data: part.data,
                providerOptions,
              },
            ];
          }
        } else if (part.type === 'json') {
          return [
            {
              type: 'text',
              text: JSON.stringify(part.value),
              providerOptions,
            },
          ];
        } else if (part.type === 'thought') {
          return [
            {
              type: 'reasoning',
              text: part.value,
              providerOptions,
            },
          ];
        } else if (part.type === 'toolCall') {
          return [
            {
              type: 'tool-call',
              toolCallId: part.id,
              toolName: part.name,
              input: part.args,
              providerOptions,
            },
          ];
        } else if (part.type === 'toolResult') {
          const parsed = zToolResultValue.safeParse(part.value);
          return [
            {
              type: 'tool-result',
              toolCallId: part.id,
              toolName: part.name,
              output: part.error
                ? { type: 'error-json', value: part.value }
                : parsed.success
                  ? {
                      type: 'content',
                      value: parsed.data
                        .flatMap(transform)
                        .flatMap(
                          (p): Extract<ToolResultPart['output'], { type: 'content' }>['value'] => {
                            if (p.type === 'text') {
                              return [{ type: 'text', text: p.value }];
                            } else if (p.type === 'file') {
                              if (p.mime.startsWith('image/')) {
                                return [{ type: 'image-data', mediaType: p.mime, data: p.data }];
                              } else {
                                return [
                                  {
                                    type: 'file-data',
                                    filename: p.name,
                                    mediaType: p.mime,
                                    data: p.data,
                                  },
                                ];
                              }
                            } else if (p.type === 'json') {
                              return [{ type: 'text', text: JSON.stringify(p.value) }];
                            }
                            console.warn('[provider] invalid tool output:', p);
                            return [];
                          },
                        ),
                    }
                  : { type: 'json', value: part.value },
              providerOptions,
            },
          ];
        }
        return [];
      };

      (message.content as any[]).push(...toSdkPart(part));
    }

    if (message.content.length) {
      sdkMessages.push(message);
    }
  }

  return sdkMessages;
}

function cleanSignatureReturn(
  signatureReturn: ReturnType<NonNullable<ChatProvider['getPartSignatureReturn']>>,
) {
  if (!signatureReturn) return undefined;
  const cleaned: Record<string, any> = {};
  for (const [k, p] of Object.entries(signatureReturn)) {
    if (Object.entries(p as Record<string, any>).some(([_, v]) => v !== undefined)) cleaned[k] = p;
  }
  return Object.entries(cleaned).length ? cleaned : undefined;
}

export function fromSdkContent(
  user: zUser,
  config: zConfig,
  provider: ChatProvider,
  event: TextStreamPart<any> | ObjectStreamPart<any>,
): zGenerateOutput | null {
  let signature = provider.getPartSignature?.(user, config, event);
  signature = cleanSignature(signature);

  if (
    event.type === 'reasoning-start' ||
    event.type === 'reasoning-delta' ||
    event.type === 'reasoning-end'
  ) {
    return {
      type: 'data',
      value: {
        type: 'thought',
        id: event.id,
        value: 'text' in event ? event.text : '',
        signature,
      },
    };
  } else if (event.type === 'object') {
    return {
      type: 'data',
      value: {
        type: 'json',
        value: event.object,
        signature,
      },
    };
  } else if (
    event.type === 'text-start' ||
    event.type === 'text-delta' ||
    event.type === 'text-end'
  ) {
    return {
      type: 'data',
      value: {
        type: 'text',
        id: 'id' in event ? event.id : '',
        value: 'text' in event ? event.text : '',
        signature,
      },
    };
  } else if (event.type === 'file') {
    return {
      type: 'data',
      value: {
        type: 'file',
        mime: event.file.mediaType,
        data: event.file.base64,
        signature,
      },
    };
  } else if (event.type === 'tool-call') {
    return {
      type: 'data',
      value: {
        type: 'toolCall',
        name: event.toolName,
        id: event.toolCallId,
        args: event.input,
        signature,
      },
    };
  } else if (event.type === 'tool-result') {
    return {
      type: 'data',
      value: {
        type: 'toolResult',
        name: event.toolName,
        id: event.toolCallId,
        value: [
          {
            type: 'json',
            value: event.output as JSONType,
          },
        ],
      },
    };
  }

  if (event.type === 'finish' && event.finishReason === 'error') {
    throw new Error(
      'rawFinishReason' in event ? event.rawFinishReason : (event.finishReason ?? 'Unknown error'),
    );
  } else if (event.type === 'error') {
    throw event.error;
  } else if (
    event.type === 'finish' &&
    (event.finishReason === 'length' ||
      event.finishReason === 'content-filter' ||
      event.finishReason === 'other')
  ) {
    return {
      type: 'data',
      value: {
        type: 'abort',
        reason: event.finishReason === 'content-filter' ? 'content' : event.finishReason,
        message: 'rawFinishReason' in event ? event.rawFinishReason : undefined,
      },
    };
  }

  return null;
}

function cleanSignature(signature: ReturnType<NonNullable<ChatProvider['getPartSignature']>>) {
  if (!signature) return undefined;
  for (const [k, v] of Object.entries(signature)) {
    if (k !== 'model' && v !== undefined) return signature;
  }
  return undefined;
}

export async function runEmbedding(
  user: zUser,
  provider: ChatProvider,
  texts: string[],
  config: zConfig,
  env: Env,
) {
  const clientModel = provider.getClientEmbedModel(user, config.model, env);
  if (!clientModel) throw new Error(`No embedding model available for ${config.model}`);
  // config = prepareConfig(config, provider.getModelArgs(config.model)); - no used args at the moment
  return (await embedMany({ model: clientModel, values: texts })).embeddings;
}

export function prepareConfig(config: zConfig, args: ModelArg[]) {
  console.log('[provider] model args:', args);
  const inputArgs = (config.args ?? {}) as Record<string, unknown>;
  for (const arg of args) {
    if (inputArgs?.[arg.name] === undefined) {
      console.log(`[provider] using default ${arg.default} for arg ${arg.name}`);
      if (config.args === undefined) config.args = {};
      inputArgs[arg.name] = arg.default;
    }
  }
  config.args = inputArgs;
  return config;
}
