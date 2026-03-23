import type { ContextItem, Model, ModelArg, zConfig, zData, zGenerateOutput } from '../../types.ts';
import { zMetadata } from '../../types.ts';
import {
  type Content,
  type FunctionDeclaration,
  GoogleGenAI,
  type Part,
  type SendMessageParameters,
  ThinkingLevel,
} from '@google/genai';
import { Author } from '../../../generated/prisma/enums.ts';
import { type ChatProvider, SettingsError } from './index.ts';
import type { ToolCall } from '../../tools/index.ts';

export const GoogleAIStudio: ChatProvider = {
  name: 'google-ai-studio',
  settings: ['apiKey'],

  async getModels(user) {
    if (!user?.settings?.providers?.[this.name].apiKey) return [];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(user.settings.providers[this.name].apiKey as string)}`,
    );

    const json = (await response.json()) as {
      models: { name: string; supportedGenerationMethods: string[] }[];
    };

    return json.models.map((model) => {
      const args: ModelArg[] = [
        { name: 'temperature', type: 'range', min: 0, max: 2, step: 0.05, default: 1 },
        ...(model.name.includes('gemini-2.5')
          ? [
              {
                name: 'thinking',
                type: 'list',
                values: ['off', 'low', 'medium', 'high', 'auto'],
                default: 'auto',
              } as ModelArg,
            ]
          : []),
        ...(model.name.includes('gemini-3')
          ? [
              {
                name: 'thinking',
                type: 'list',
                values: ['minimal', 'low', 'medium', 'high', 'auto'],
                default: 'auto',
              } as ModelArg,
            ]
          : []),
      ];
      return {
        name: model.name.split('/')[model.name.split('/').length - 1],
        features: [
          ...(model.supportedGenerationMethods.includes('generateContent')
            ? ['generate' as const]
            : []),
          ...(model.supportedGenerationMethods.includes('embedContent') ? ['embed' as const] : []),
        ],
        args,
      } satisfies Model;
    });
  },

  async *generate(user, instructions, context, config, abortSignal, tools?) {
    if (!user.settings.providers?.[this.name]?.apiKey) throw new SettingsError();

    const client = new GoogleGenAI({ apiKey: user.settings.providers[this.name].apiKey });

    const params: SendMessageParameters = {
      message: toSdkContent(context[context.length - 1], config).parts!,
    };

    params.config = {
      abortSignal,
      temperature: config.args.temperature as number,
      enableEnhancedCivicAnswers: true,
    };

    if (config.schema) {
      params.config.responseMimeType = 'application/json';
      params.config.responseJsonSchema = config.schema;
    }

    if (config.model.includes('-image') || config.model.includes('gemini-3')) {
      params.config.responseModalities = ['TEXT', 'IMAGE'];
    }

    if (config.model.startsWith('gemini-') && !config.model.includes('-image')) {
      params.config.systemInstruction = instructions;
      params.config.thinkingConfig = { includeThoughts: true };
      params.config.tools = [
        //{googleSearch: {}, codeExecution: {}}, - TODO - disabling search+code just for a model that can't send a GOD DAMN TOOL ARG?!
        ...(tools?.length ? [{ functionDeclarations: toSdkTools(tools) }] : []),
      ];

      if (config.model.includes('-2.5')) {
        params.config.thinkingConfig.thinkingBudget = {
          off: 0,
          low: 5000,
          medium: 10000,
          high: 15000,
          auto: -1,
        }[(config.args.thinking ?? 'auto') as string];
      } else if (config.model.includes('-3')) {
        params.config.thinkingConfig.thinkingLevel = {
          minimal: ThinkingLevel.MINIMAL,
          low: ThinkingLevel.LOW,
          medium: ThinkingLevel.MEDIUM,
          high: ThinkingLevel.HIGH,
          auto: ThinkingLevel.THINKING_LEVEL_UNSPECIFIED,
        }[(config.args.thinking ?? 'auto') as string];
      }
    } else {
      // Models without system instruction support: inject into first message's history
      console.log("Model doesn't support system instructions; injecting into history");
      (context[0].data as zData).unshift({ type: 'text', value: instructions });
    }

    const stream = await client.chats
      .create({
        model: config.model,
        history: context.slice(0, context.length - 1).map((m) => toSdkContent(m, config)),
      })
      .sendMessageStream(params);

    yield* fromSdkStream(stream);
  },

  async embed(user, texts, config) {
    if (!user.settings?.providers?.[this.name]?.apiKey) return [];

    const client = new GoogleGenAI({ apiKey: user.settings.providers[this.name].apiKey });

    const response = await client.models.embedContent({
      model: config.model,
      contents: texts,
    });

    return response.embeddings?.map((e) => e.values ?? []) ?? [];
  },
};

function stripUnsupportedFields(schema: any): any {
  if (typeof schema !== 'object' || schema === null) return schema;
  // Google's API does not support $schema or additionalProperties —
  // their presence causes the entire parameter schema to be silently dropped.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, additionalProperties, ...rest } = schema;
  return Object.fromEntries(
    Object.entries(rest as Record<string, unknown>).map(([k, v]) => [
      k,
      Array.isArray(v) ? v : typeof v === 'object' ? stripUnsupportedFields(v) : v,
    ]),
  );
}

function toSdkTools(tools: ToolCall[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: stripUnsupportedFields(tool.parameters),
  }));
}

function toSdkContent(message: ContextItem, config: zConfig): Content {
  const isSameModel = message.id && message.config.model === config.model;
  return {
    role: message.author === Author.USER ? 'user' : 'model',
    parts: message.data.flatMap((part): Part[] => {
      if (part.type === 'text') {
        const youtubeRegex =
          /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
        const parts: Part[] = [];
        let lastIndex = 0;
        let match;

        while ((match = youtubeRegex.exec(part.value)) !== null) {
          const textBefore = part.value.substring(lastIndex, match.index);
          if (textBefore) {
            parts.push({ text: textBefore });
          }
          parts.push({
            fileData: {
              mimeType: 'video/mp4',
              fileUri: match[0],
            },
          });
          lastIndex = youtubeRegex.lastIndex;
        }

        const textAfter = part.value.substring(lastIndex);
        if (textAfter) {
          parts.push({ text: textAfter });
        }

        return parts.length > 0 ? parts : [{ text: part.value }];
      }
      if (part.type === 'thought' && isSameModel) {
        const match = message.metadata.flat().find((p) => p.thought && p.thoughtSignature);
        return [
          {
            thought: true,
            thoughtSignature: match?.thoughtSignature ?? 'skip_thought_signature_validator',
            text: part.value,
          },
        ];
      }
      if (part.type === 'inputFile') {
        return [{ inlineData: { mimeType: part.mime, data: part.data } }];
      }
      if (part.type === 'toolCall' && message.id) {
        const match = message.metadata
          .flat()
          .find(
            (p) =>
              p.functionCall?.name === part.name &&
              p.functionCall?.id === part.id &&
              p.thoughtSignature,
          );
        return [
          {
            functionCall: {
              id: part.id,
              name: part.name,
              args: part.args ?? {},
            },
            thoughtSignature: match?.thoughtSignature ?? 'skip_thought_signature_validator',
          },
        ];
      }
      if (part.type === 'toolResult') {
        return [
          {
            functionResponse: {
              id: part.id,
              name: part.name,
              response: {
                result: !part.error ? part.value : undefined,
                error: part.error ? part.value : undefined,
              },
            },
          },
        ];
      }
      return [];
    }),
  };
}

async function* fromSdkStream(stream: AsyncIterable<any>): AsyncGenerator<zGenerateOutput> {
  const parts: Part[] = [];

  try {
    for await (const chunk of stream) {
      if (!chunk.candidates?.length || !chunk.candidates[0].content?.parts) continue;

      for (const part of chunk.candidates[0].content.parts) {
        if (part.text) {
          if (part.thought) {
            yield { type: 'data', value: { type: 'thought', value: part.text } };
          } else {
            yield { type: 'data', value: { type: 'text', value: part.text } };
          }
        }
        if (part.inlineData) {
          yield {
            type: 'data',
            value: {
              type: 'outputFile',
              name: part.inlineData.displayName,
              mime: part.inlineData.mimeType,
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            },
          };
        }
        if (part.functionCall) {
          yield {
            type: 'data',
            value: {
              type: 'toolCall',
              id: part.functionCall.id ?? part.functionCall.name,
              name: part.functionCall.name,
              args: part.functionCall.args ?? {},
            },
          };
        }
        parts.push(part as Part);
      }
    }
  } catch (e: any) {
    if (e?.name?.includes('AbortError')) return;
    throw e;
  }

  yield { type: 'special', value: { type: 'metadata', value: zMetadata.parse(parts) } };
}
