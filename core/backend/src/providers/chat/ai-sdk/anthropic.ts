import type { AISdkSubprovider } from './index.ts';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Anthropic } from '@anthropic-ai/sdk';
import type { Model } from '../../../types.ts';
import { AnthropicFamily } from '../../../families/anthropic.ts';

export const AnthropicProvider: AISdkSubprovider = {
  name: 'anthropic',
  settings: ['apiKey'],

  getClient(user) {
    const apiKey = user?.settings?.providers?.anthropic?.apiKey;
    if (!apiKey) return null;
    return createAnthropic({
      apiKey: apiKey as string,
    });
  },

  getClientModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createAnthropic>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientOptions(_user, config) {
    return {
      anthropic: {
        thinking:
          config.args?.thinking === 'adaptive' || config.args?.thinking === 'disabled'
            ? { type: config.args.thinking }
            : config.args?.thinking
              ? { type: 'enabled', budgetTokens: parseInt(config.args.thinking as string) }
              : undefined,
      } satisfies AnthropicProviderOptions,
    };
  },

  async getModels(user) {
    const apiKey = user?.settings?.providers?.anthropic?.apiKey;
    if (!apiKey) return [];

    const client = new Anthropic({ apiKey: apiKey as string });

    const models = await client.models.list();

    return models.data.map((m) => {
      return {
        name: m.id,
        features: ['generate' as const, 'toolCall' as const],
        args: AnthropicFamily.getArgs(m.id),
      } satisfies Model;
    });
  },
};
