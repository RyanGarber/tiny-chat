import type { AISdkProvider } from './index.ts';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Anthropic } from '@anthropic-ai/sdk';
import type { Model } from '../../../types.ts';
import { getCommonArgs } from '../../../utils/consts.ts';

export const AnthropicProvider: AISdkProvider = {
  name: 'anthropic-ai',
  settings: ['apiKey'],
  getClient(user) {
    const apiKey = user?.settings?.providers?.['anthropic-ai']?.apiKey;
    if (!apiKey) return null;
    return createAnthropic({
      apiKey: apiKey as string,
    });
  },
  async getModels(user) {
    const apiKey = user?.settings?.providers?.['anthropic-ai']?.apiKey;
    if (!apiKey) return [];

    const client = new Anthropic({ apiKey: apiKey as string });

    const models = await client.models.list();

    return models.data.map((m) => {
      return {
        name: m.id,
        features: ['generate' as const, 'toolCall' as const],
        args: getCommonArgs(1),
      } satisfies Model;
    });
  },
};
