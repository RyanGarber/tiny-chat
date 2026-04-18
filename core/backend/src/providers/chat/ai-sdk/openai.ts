import type { AISdkSubprovider } from './index.ts';
import { createOpenAI } from '@ai-sdk/openai';
import OpenAI from 'openai';
import type { Model } from '../../../types.ts';
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/azure';
import { OpenAIFamily } from '../../../families/openai.ts';

export const OpenAIProvider: AISdkSubprovider = {
  name: 'openai',
  settings: ['apiKey'],

  getClient(user) {
    const apiKey = user?.settings?.providers?.openai?.apiKey;
    if (!apiKey) return null;
    return createOpenAI({
      apiKey: apiKey as string,
    });
  },

  getClientModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createOpenAI>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientOptions(_user, config) {
    return {
      reasoningEffort: config.args?.reasoning,
      reasoningSummary: 'auto',
      include: ['reasoning.encrypted_content'],
    } satisfies OpenAIResponsesProviderOptions;
  },

  async getModels(user) {
    const apiKey = user?.settings?.providers?.openai?.apiKey;
    if (!apiKey) return [];

    const client = new OpenAI({ apiKey: apiKey as string });

    const models = await client.models.list();

    return models.data.flatMap((m): Model[] => {
      if (
        [
          '-image',
          '-audio',
          '-realtime',
          '-search',
          '-transcribe',
          'tts',
          'whisper',
          'dall-e',
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
          args: OpenAIFamily.getArgs(m.id),
        } satisfies Model,
      ];
    });
  },
};
