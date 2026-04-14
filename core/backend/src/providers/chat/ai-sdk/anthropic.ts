import type { AISdkProvider } from './index.ts';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Anthropic } from '@anthropic-ai/sdk';
import type { Model } from '../../../types.ts';
import { getCommonArgs } from '../../../utils/consts.ts';

export const AnthropicProvider: AISdkProvider = {
  name: 'anthropic',
  settings: ['apiKey'],
  getClient(user) {
    const apiKey = user?.settings?.providers?.anthropic?.apiKey;
    if (!apiKey) return null;
    return createAnthropic({
      apiKey: apiKey as string,
    });
  },
  getLanguageModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createAnthropic>;
    if (!client) return null;
    return client.languageModel(id);
  },
  async getModels(user) {
    const apiKey = user?.settings?.providers?.anthropic?.apiKey;
    if (!apiKey) return [];

    const client = new Anthropic({ apiKey: apiKey as string });

    const models = await client.models.list();

    return models.data.map((m) => {
      const args = getCommonArgs(1);
      if (m.id.includes('claude-4.5')) {
        args.push({
          name: 'thinking',
          type: 'list' as const,
          values: ['disabled', '2500', '5000', '7500', '10000'],
          default: '2500',
        });
      }
      if (m.id.includes('claude-4.6')) {
        args.push({
          name: 'thinking',
          type: 'list' as const,
          values: ['disabled', 'adaptive'],
          default: 'adaptive',
        });
      }
      return {
        name: m.id,
        features: ['generate' as const, 'toolCall' as const],
        args,
      } satisfies Model;
    });
  },
};
