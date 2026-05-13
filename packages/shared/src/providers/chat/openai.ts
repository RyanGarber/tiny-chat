import { createOpenAI } from '@ai-sdk/openai';
import OpenAI from 'openai';
import type { Model, ModelArg } from '../../types/chat.ts';
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/azure';
import type { ChatProvider } from './index.ts';
import { getBaseModelArgs, getBaseModelTransform } from '../../utils.ts';

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

  getClientModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createOpenAI>;
    if (!client) return null;
    return client.languageModel(id);
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

  getPartTransformed(_user, _config, _message, part) {
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

  getPartSignatureReturn(_user, config, _message, part) {
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
        [
          '-audio',
          '-realtime',
          '-search',
          '-transcribe',
          'tts',
          'whisper',
          'sora',
          'moderation',
        ].some((t) => m.id.includes(t))
      )
        return [];

      if (m.id.includes('-embedding'))
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
    if (['gpt-', 'o1', 'o3', 'o4'].some((m) => model.includes(m))) {
      const isReasoning = ['gpt-5', 'gpt-4o', 'o1', 'o3', 'o4'].some((m) => model.includes(m));
      args.push(...getBaseModelArgs(isReasoning ? -1 : 2));
      if (isReasoning) {
        args.push({
          name: 'reasoning',
          type: 'list',
          values: ['off', 'low', 'medium', 'high'],
          default: 'medium',
        });
      }
    }
    return args;
  },
};
