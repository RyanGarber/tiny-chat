import type { ChatProvider } from '../index.ts';
import { GoogleGenerativeAIProvider } from './google-generative-ai.ts';
import type {
  AssistantModelMessage,
  TextPart,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage,
} from 'ai';
import { embedMany, type Provider, streamText, type Tool } from 'ai';
import { Author } from '../../../../generated/prisma/enums.ts';
import { type Model, type zGenerateOutput } from '../../../types.ts';
import { type User } from '../../../server.ts';

export interface AISdkProvider {
  name: string;
  getClient: (user: User) => Partial<Provider> | null;
  getModels: (user: User) => Promise<Model[]>;
}

const providers = [GoogleGenerativeAIProvider];

export const AISdkProvider: ChatProvider = {
  name: 'ai-sdk',
  settings: [],

  async getModels(user) {
    const models: Awaited<ReturnType<ChatProvider['getModels']>>[] = await Promise.all(
      providers.map((provider) => provider.getModels(user)),
    );
    return models.flat();
  },

  async *generate(user, instructions, context, config, abortSignal, tools) {
    const provider = providers.find((p) => p.name === 'google-generative-ai');
    if (!provider) throw new Error('Provider not found');
    const client = provider.getClient(user);
    if (!client?.languageModel?.(config.model))
      throw new Error('Language model not found in provider');

    const stream = streamText({
      model: client.languageModel(config.model),
      system: instructions,
      tools: Object.fromEntries(
        tools.map((tool) => [
          tool.name,
          {
            description: tool.description,
            inputSchema: tool.schema,
          } satisfies Tool,
        ]),
      ),
      messages: context.map((m) => {
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
            content: m.data.flatMap((part): (TextPart | ToolCallPart)[] => {
              if (part.type === 'text') {
                return [{ type: 'text', text: part.value }];
              } else if (part.type === 'toolCall') {
                const match = m.id
                  ? m.metadata
                      .flat()
                      .find(
                        (p) =>
                          p.functionCall?.name === part.name &&
                          p.functionCall?.id === part.id &&
                          p.thoughtSignature,
                      )
                  : null;

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
          content: m.data.flatMap((part) => {
            if (part.type === 'text') {
              return [{ type: 'text', text: part.value }];
            }
            // Note: You can also map inputFile to 'file' / 'image' parts here!
            return [];
          }),
        } satisfies UserModelMessage;
      }),
      abortSignal,
    });

    for await (const part of stream.fullStream) {
      if (part.type === 'text-delta') {
        yield { type: 'data', value: { type: 'text', value: part.text } } satisfies zGenerateOutput;
      } else if (part.type === 'tool-call') {
        yield {
          type: 'data',
          value: { type: 'toolCall', name: part.toolName, id: part.toolCallId, args: part.input },
        } satisfies zGenerateOutput;
      } else if (part.type === 'tool-result') {
        yield {
          type: 'data',
          value: {
            type: 'toolResult',
            name: part.toolName,
            id: part.toolCallId,
            value: part.output,
          },
        } satisfies zGenerateOutput;
      }
    }
  },

  async embed(user, texts, config) {
    const provider = providers.find((p) => p.name === 'google-generative-ai');
    if (!provider) throw new Error('Provider not found');
    const client = provider.getClient(user);
    if (!client?.embeddingModel?.(config.model))
      throw new Error('Embedding model not found in provider');

    return (
      await embedMany({
        model: client.embeddingModel(config.model),
        values: texts,
      })
    ).embeddings;
  },
};
