import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Anthropic } from '@anthropic-ai/sdk';
import type { Model, ModelArg } from '../../types/chat.ts';
import type { ChatProvider } from './index.ts';
import { getBaseModelArgs, getBaseModelTransform } from '../../utils.ts';

export const AnthropicProvider: ChatProvider = {
  name: 'anthropic',
  settings: ['apiKey'],

  getClient(user) {
    const apiKey = user?.settings?.providers?.anthropic?.apiKey;
    if (!apiKey) return null;
    return createAnthropic({
      apiKey: apiKey as string,
    });
  },

  getClientModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createAnthropic>;
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

    const client = new Anthropic({ apiKey: apiKey as string, dangerouslyAllowBrowser: true });

    const models = await client.models.list();

    return models.data.map((m) => {
      return {
        name: m.id,
        features: ['generate' as const, 'toolCall' as const],
        args: this.getModelArgs(m.id),
      } satisfies Model;
    });
  },

  getPartTransformed(_user, _config, _message, part) {
    return [getBaseModelTransform(part, 'image/', 'application/pdf')];
  },

  getModelArgs(model) {
    const args: ModelArg[] = [];
    if (model.includes('claude-')) {
      args.push(...getBaseModelArgs(1));
      if (model.includes('-4-5')) {
        args.push({
          name: 'thinking',
          type: 'list' as const,
          values: ['disabled', '2500', '5000', '7500', '10000'],
          default: '2500',
        });
      }
      if (model.includes('-4-6') || model.includes('-4-7')) {
        args.push({
          name: 'thinking',
          type: 'list' as const,
          values: ['disabled', 'adaptive'],
          default: 'adaptive',
        });
      }
    }
    return args;
  },
};
