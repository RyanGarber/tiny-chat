import type { ChatProvider } from '../index.ts';
import { GoogleGenerativeAIProvider } from './google-generative-ai.ts';
import { AnthropicProvider } from './anthropic.ts';
import { OpenAIProvider } from './openai.ts';
import { AzureProvider } from './azure.ts';
import type {
  AssistantContent,
  AssistantModelMessage,
  FilePart,
  ImagePart,
  ModelMessage,
  Provider,
  TextPart,
  TextStreamPart,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  UserContent,
  UserModelMessage,
} from 'ai';
import { embedMany, streamText, type Tool } from 'ai';
import { Author } from '../../../../generated/prisma/enums.ts';
import { type Model, type zGenerateOutput } from '../../../types.ts';
import { type User } from '../../../server.ts';
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/azure';
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';

export interface AISdkProvider {
  name: string;
  settings: string[];
  getClient: (user: User) => Partial<Provider> | null;
  getModels: (user: User) => Promise<Model[]>;
}

export function wrap(internal: AISdkProvider): ChatProvider {
  return {
    name: internal.name,
    settings: internal.settings,
    getModels: (user) => internal.getModels(user),
    generate: (user, instructions, context, config, abortSignal, tools) =>
      AISdkProvider.generate(
        user,
        instructions,
        context,
        { ...config, provider: internal.name },
        abortSignal,
        tools,
      ),
    embed: (user, texts, config) =>
      AISdkProvider.embed(user, texts, { ...config, provider: internal.name }),
  };
}

const providers = [GoogleGenerativeAIProvider, AnthropicProvider, OpenAIProvider, AzureProvider];

export const AISdkProvider: ChatProvider = {
  name: 'ai-sdk',
  settings: [],

  async getModels(user) {
    const models: Model[][] = await Promise.all(
      providers.map((provider) => provider.getModels(user)),
    );
    return models.flat();
  },

  async *generate(user, instructions, context, config, abortSignal, tools) {
    let client: Partial<Provider> | null = null;
    let supportsToolCall = false;

    // Find the internal provider that has this model
    for (const provider of providers) {
      const models = await provider.getModels(user);
      const model = models.find((m) => m.name === config.model);
      if (model) {
        client = provider.getClient(user);
        supportsToolCall = model.features.includes('toolCall');
        break;
      }
    }

    if (!client) {
      throw new Error(`No available model named '${config.model}'`);
    }
    if (!client.languageModel?.(config.model)) {
      throw new Error(`Model '${config.model}' is not a language model`);
    }

    const sdkData: TextStreamPart<any>[] = [];
    const rawData: any[] = [];

    const stream = streamText({
      model: client.languageModel(config.model),
      system: instructions,
      maxOutputTokens: config.args?.['max-tokens'],
      temperature: config.args?.temperature as number,
      providerOptions: {
        // TODO - move to generic provider hook
        openai: {
          reasoningEffort: config.args?.reasoning,
        } satisfies OpenAIResponsesProviderOptions,
        azure: {
          reasoningEffort: config.args?.reasoning,
        } satisfies OpenAIResponsesProviderOptions,
        google: {
          thinkingConfig:
            config.args?.thinking ||
            (config.args?.['thinking-budget'] && config.args['thinking-budget'] !== 'auto')
              ? {
                  includeThoughts: true,
                  thinkingLevel: config.args?.thinking,
                  thinkingBudget:
                    config.args?.['thinking-budget'] && config.args['thinking-budget'] !== 'auto'
                      ? parseInt(config.args['thinking-budget'] as string)
                      : undefined,
                }
              : undefined,
        } satisfies GoogleGenerativeAIProviderOptions,
      },
      tools: supportsToolCall
        ? Object.fromEntries(
            tools.map((tool) => [
              tool.name,
              {
                description: tool.description,
                inputSchema: tool.schema,
              } satisfies Tool,
            ]),
          )
        : undefined,
      messages: context.map((m): ModelMessage => {
        const isToolResult = m.data.some((p) => p.type === 'toolResult');
        const isToolCall = m.data.some((p) => p.type === 'toolCall');

        // 1. Tool Results -> CoreToolMessage
        if (isToolResult) {
          return {
            role: 'tool',
            content: m.data.flatMap((part) => {
              if (part.type === 'toolResult') {
                return [
                  {
                    type: 'tool-result',
                    toolCallId: part.id,
                    toolName: part.name,
                    output: part.error
                      ? { type: 'error-json', value: part.value }
                      : { type: 'json', value: part.value },
                  } satisfies ToolResultPart,
                ];
              }
              return [];
            }),
          } satisfies ToolModelMessage;
        }

        // 2. Assistant turns (and Tool Calls) -> CoreAssistantMessage
        if (m.author === Author.MODEL || isToolCall) {
          return {
            role: 'assistant',
            content: m.data.flatMap((part): Exclude<AssistantContent, string> => {
              if (part.type === 'text') {
                return [{ type: 'text', text: part.value }] satisfies TextPart[];
              } else if (part.type === 'toolCall') {
                // find ai-sdk thoughtSignature
                console.log('Looking for thoughtSignature for tool call', part.name, part.id);
                let match;
                if (m.id) {
                  for (const entry of m.metadata) {
                    for (const sdkPart of entry.sdkData ?? []) {
                      if (
                        sdkPart.type === 'tool-call' &&
                        sdkPart.toolCallId === part.id &&
                        sdkPart.toolName === part.name
                      ) {
                        match = sdkPart.providerMetadata?.google?.thoughtSignature;
                        console.log(
                          'Found thoughtSignature for tool call',
                          part.name,
                          part.id,
                          match,
                        );
                      }
                    }
                  }
                }

                console.log('[TOOL CALL]', {
                  toolCallId: part.id,
                  toolName: part.name,
                  input: part.args,
                  thoughtSignature: match,
                });
                return [
                  {
                    type: 'tool-call',
                    toolCallId: part.id,
                    toolName: part.name,
                    input: part.args,
                    providerOptions: {
                      google: {
                        thoughtSignature:
                          match?.thoughtSignature ?? 'skip_thought_signature_validator',
                      },
                    },
                  } satisfies ToolCallPart,
                ];
              }
              return [];
            }),
          } satisfies AssistantModelMessage;
        }

        // 3. User turns -> CoreUserMessage
        return {
          role: 'user',
          content: m.data.flatMap((part): Exclude<UserContent, string> => {
            if (part.type === 'text') {
              const youtubeRegex =
                /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)[\w-]{11}/g;
              const parts: (TextPart | FilePart)[] = [];
              let lastIndex = 0;
              let match;

              // TODO - move to generic provider hook
              while ((match = youtubeRegex.exec(part.value)) !== null) {
                const textBefore = part.value.substring(lastIndex, match.index);
                if (textBefore) {
                  parts.push({ type: 'text', text: textBefore });
                }
                parts.push({
                  type: 'file',
                  data: match[0],
                  mediaType: 'video/mp4',
                });
                lastIndex = youtubeRegex.lastIndex;
              }

              const textAfter = part.value.substring(lastIndex);
              if (textAfter) {
                parts.push({ type: 'text', text: textAfter });
              }

              return parts.length > 0 && config.model.includes('gemini')
                ? parts
                : [{ type: 'text', text: part.value }];
            }
            if (part.type === 'inputFile') {
              if (part.mime.startsWith('image/')) {
                return [
                  { type: 'image', image: part.data, mediaType: part.mime } satisfies ImagePart,
                ];
              } else if (part.mime === 'text/plain' || part.mime === 'text/markdown') {
                return [{ type: 'text', text: part.data } satisfies TextPart];
              }
              return [
                {
                  type: 'file',
                  data: part.data,
                  mediaType: part.mime,
                  filename: part.name,
                } satisfies FilePart,
              ];
            }
            return [];
          }),
        } satisfies UserModelMessage;
      }),
      abortSignal,
    });

    for await (const chunk of stream.fullStream) {
      console.log('[AI-SDK]', chunk);
      sdkData.push(chunk);
      if (chunk.type === 'reasoning-delta') {
        yield {
          type: 'data',
          value: { type: 'thought', value: chunk.text },
        } satisfies zGenerateOutput;
      } else if (chunk.type === 'text-delta') {
        yield {
          type: 'data',
          value: { type: 'text', value: chunk.text },
        } satisfies zGenerateOutput;
      } else if (chunk.type === 'tool-call') {
        yield {
          type: 'data',
          value: {
            type: 'toolCall',
            name: chunk.toolName,
            id: chunk.toolCallId,
            args: chunk.input,
          },
        } satisfies zGenerateOutput;
      } else if (chunk.type === 'tool-result') {
        yield {
          type: 'data',
          value: {
            type: 'toolResult',
            name: chunk.toolName,
            id: chunk.toolCallId,
            value: chunk.output,
          },
        } satisfies zGenerateOutput;
      } else if (chunk.type === 'raw') {
        rawData.push(chunk.rawValue);
      }

      if (chunk.type === 'finish' || chunk.type === 'error') {
        yield {
          type: 'special',
          value: {
            type: 'metadata',
            value: [
              {
                rawData,
                sdkData,
                finishReason: chunk.type === 'finish' ? chunk.finishReason : undefined,
                rawFinishReason: chunk.type === 'finish' ? chunk.rawFinishReason : undefined,
              },
            ],
          },
        };
      }

      if (chunk.type === 'finish' && chunk.finishReason === 'error') {
        throw new Error(chunk.rawFinishReason ?? 'Unknown error');
      } else if (chunk.type === 'error') {
        throw chunk.error;
      } else if (
        chunk.type === 'finish' &&
        (chunk.finishReason === 'length' ||
          chunk.finishReason === 'content-filter' ||
          chunk.finishReason === 'other')
      ) {
        yield {
          type: 'data',
          value: {
            type: 'abort',
            reason: chunk.finishReason === 'content-filter' ? 'content' : chunk.finishReason,
            details: chunk.rawFinishReason,
          },
        };
      }
    }
  },

  async embed(user, texts, config) {
    let client: Partial<Provider> | null = null;
    for (const provider of providers) {
      const models = await provider.getModels(user);
      if (models.some((m) => m.name === config.model)) {
        client = provider.getClient(user);
        break;
      }
    }

    if (!client) throw new Error(`Provider not found or not configured for model ${config.model}`);
    if (!client.embeddingModel?.(config.model))
      throw new Error(`Embedding model not found in provider for model ${config.model}`);

    return (
      await embedMany({
        model: client.embeddingModel(config.model),
        values: texts,
      })
    ).embeddings;
  },
};
