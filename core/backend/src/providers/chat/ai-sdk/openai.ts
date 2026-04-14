import type { AISdkProvider } from './index.ts';
import { createOpenAI } from '@ai-sdk/openai';
import OpenAI from 'openai';
import type { Model } from '../../../types.ts';
import { getCommonArgs } from '../../../utils/consts.ts';

export const OpenAIProvider: AISdkProvider = {
  name: 'openai',
  settings: ['apiKey'],
  getClient(user) {
    const apiKey = user?.settings?.providers?.openai?.apiKey;
    if (!apiKey) return null;
    return createOpenAI({
      apiKey: apiKey as string,
    });
  },
  getLanguageModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createOpenAI>;
    if (!client) return null;
    return client.languageModel(id);
  },
  async getModels(user) {
    const apiKey = user?.settings?.providers?.openai?.apiKey;
    if (!apiKey) return [];

    const client = new OpenAI({ apiKey: apiKey as string });

    const models = await client.models.list();

    return models.data.flatMap((m): Model[] => {
      if (
        m.id.includes('-embedding') ||
        m.id.includes('-image') ||
        m.id.includes('-audio') ||
        m.id.includes('-realtime') ||
        m.id.includes('-search') ||
        m.id.includes('-transcribe') ||
        m.id.includes('tts') ||
        m.id.includes('whisper') ||
        m.id.includes('dall-e') ||
        m.id.includes('sora') ||
        m.id.includes('moderation')
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

      const reasoning =
        m.id.includes('gpt-5') ||
        m.id.includes('gpt-4o') ||
        m.id.includes('o1') ||
        m.id.includes('o3') ||
        m.id.includes('o4');

      const args = getCommonArgs(reasoning ? -1 : 2);
      if (reasoning) {
        args.push({
          name: 'reasoning',
          type: 'list',
          values: ['low', 'medium', 'high'],
          default: 'medium',
        });
      }
      return [
        {
          name: m.id,
          features: ['generate' as const, 'toolCall' as const],
          args,
        } satisfies Model,
      ];
    });
  },
};
