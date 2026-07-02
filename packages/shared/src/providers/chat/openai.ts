import { createOpenAI } from '@ai-sdk/openai';
import OpenAI from 'openai';
import type { Model, ModelArg } from '../../types/chat.ts';
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/azure';
import type { ChatProvider } from './index.ts';
import { getBaseModelArgs, getBaseModelTransform, isModelVersion } from '../../utils.ts';

export const OpenAIProvider: ChatProvider = {
  name: 'openai',
  settings: ['apiKey'],

  getClient(user) {
    const apiKey = user?.settings?.providers?.openai?.apiKey;
    if (!apiKey) return null;
    return createOpenAI({
      apiKey: apiKey as string,
    });
  },

  getClientGenerateModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createOpenAI>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientEmbedModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createOpenAI>;
    if (!client) return null;
    return client.embeddingModel(id);
  },

  getClientOptions(_user, config) {
    return {
      openai: {
        reasoningEffort: config.args?.reasoning,
        reasoningSummary: 'detailed',
        include: ['reasoning.encrypted_content'],
      } satisfies OpenAIResponsesProviderOptions,
    };
  },

  getPartTransformed(_user, _config, part) {
    return [getBaseModelTransform(part, 'image/', 'application/pdf')];
  },

  getPartSignature(_user, config, part) {
    if ('providerMetadata' in part) {
      return {
        model: config.model,
        item: part.providerMetadata?.openai?.itemId as any,
        reasoning: part.providerMetadata?.openai?.reasoningEncryptedContent as any,
      };
    }
  },

  getPartSignatureReturn(_user, config, part) {
    if ('signature' in part) {
      return {
        openai: {
          itemId: part.signature?.item,
          reasoningEncryptedContent:
            part.signature?.model === config.model ? part.signature?.reasoning : undefined,
        },
      };
    }
  },

  async getModels(user) {
    const apiKey = user?.settings?.providers?.openai?.apiKey;
    if (!apiKey) return [];

    const client = new OpenAI({ apiKey: apiKey as string, dangerouslyAllowBrowser: true });

    const models = await client.models.list();

    return models.data.flatMap((m): Model[] => {
      if (
        isModelVersion(
          m.id,
          'audio',
          'realtime',
          'search',
          'transcribe',
          'tts',
          'whisper',
          'sora',
          'moderation',
        )
      )
        return [];

      if (isModelVersion(m.id, 'embedding'))
        return [
          {
            name: m.id,
            features: ['embed' as const],
            args: [],
          } satisfies Model,
        ];

      return [
        {
          name: m.id,
          features: ['generate' as const, 'toolCall' as const],
          args: this.getModelArgs(m.id),
        } satisfies Model,
      ];
    });
  },

  getModelArgs(model) {
    const args: ModelArg[] = [];
    if (isModelVersion(model, 'gpt', 'o1', 'o3', 'o4')) {
      const isReasoning = isModelVersion(model, 'gpt 5', 'gpt 4o', 'o1', 'o3', 'o4');
      args.push(...getBaseModelArgs(isReasoning ? -1 : 2));
      if (isReasoning) {
        if (isModelVersion(model, 'gpt 5.1 codex max')) {
          args.push({
            name: 'reasoning',
            type: 'list',
            values: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
            default: 'medium',
          });
        } else if (isModelVersion(model, 'gpt 5.1')) {
          args.push({
            name: 'reasoning',
            type: 'list',
            values: ['none', 'minimal', 'low', 'medium', 'high'],
            default: 'medium',
          });
        } else {
          args.push({
            name: 'reasoning',
            type: 'list',
            values: ['minimal', 'low', 'medium', 'high'],
            default: 'medium',
          });
        }
      }
    }
    return args;
  },
};
