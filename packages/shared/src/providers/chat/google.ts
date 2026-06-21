import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { Model, ModelArg, zDataPart } from '../../types/chat.ts';
import type { ChatProvider } from './index.ts';
import { getBaseModelArgs, getBaseModelTransform, isModelVersion } from '../../utils.ts';

export const GoogleProvider: ChatProvider = {
  name: 'google',
  settings: ['apiKey'],

  getClient(user) {
    if (!user?.settings?.providers?.google?.apiKey) return null;
    return createGoogleGenerativeAI({
      apiKey: user.settings.providers.google.apiKey as string,
    });
  },

  getClientGenerateModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createGoogleGenerativeAI>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientEmbedModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createGoogleGenerativeAI>;
    if (!client) return null;
    return client.embeddingModel(id);
  },

  getClientOptions(_user, config) {
    return {
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
        responseModalities: isModelVersion(config.model, 'gemini 3')
          ? ['TEXT', 'IMAGE']
          : undefined,
      } satisfies GoogleGenerativeAIProviderOptions,
    };
  },

  getPartTransformed(_user, config, _message, part) {
    const parts: zDataPart[] = [];

    if (isModelVersion(config.model, 'gemini') && part.type === 'text') {
      const youtubeRegex =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9-_]{11})\S*/g;
      let lastIndex = 0;
      let match;

      while ((match = youtubeRegex.exec(part.value)) !== null) {
        const textBefore = part.value.substring(lastIndex, match.index);
        if (textBefore.length) {
          parts.push({ ...part, value: textBefore });
        }
        parts.push({
          type: 'file',
          data: `https://www.youtube.com/watch?v=${match[1]}`,
          mime: 'video/mp4',
        });
        lastIndex = youtubeRegex.lastIndex;
      }

      const textAfter = part.value.substring(lastIndex);
      if (textAfter.length) {
        parts.push({ ...part, value: textAfter });
      }
    } else {
      parts.push(part);
    }

    return parts.map((part) => getBaseModelTransform(part, 'video/', 'image/', 'application/pdf'));
  },

  getPartSignature(_user, config, part) {
    if ('providerMetadata' in part) {
      return {
        model: config.model,
        reasoning: part.providerMetadata?.google?.thoughtSignature as any,
      };
    }
  },

  getPartSignatureReturn(_user, config, _message, part) {
    if ('signature' in part) {
      return {
        google: {
          thoughtSignature:
            (part.signature?.model === config.model ? part.signature.reasoning : undefined) ??
            'skip_thought_signature_validator',
        },
      };
    }
  },

  async getModels(user) {
    if (!user?.settings?.providers?.google?.apiKey) return [];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        user.settings.providers.google.apiKey as string,
      )}`,
    );

    const json = (await response.json()) as {
      models: { name: string; supportedGenerationMethods: string[] }[];
    };

    return json.models.map((model) => {
      return {
        name: model.name.split('/').slice(-1)[0],
        features: [
          ...(model.supportedGenerationMethods.includes('generateContent')
            ? ['generate' as const, 'toolCall' as const]
            : []),
          //...(model.name.includes('gemini') ? ['toolCall' as const] : []),
          ...(model.supportedGenerationMethods.includes('embedContent') ? ['embed' as const] : []),
        ],
        args: this.getModelArgs(model.name),
      } satisfies Model;
    });
  },

  getModelArgs(model) {
    const args: ModelArg[] = [];
    if (isModelVersion(model, 'gemini')) {
      args.push(...getBaseModelArgs(2));
      if (isModelVersion(model, 'gemini 2.5')) {
        args.push({
          name: 'thinking-budget',
          type: 'list',
          values: ['auto', '0', '2500', '5000', '7500', '10000'],
          default: 'auto',
        });
      }
      if (isModelVersion(model, 'gemini 3')) {
        args.push({
          name: 'thinking',
          type: 'list',
          values: ['minimal', 'low', 'medium', 'high'],
          default: 'medium',
        });
      }
    }
    return args;
  },
};
