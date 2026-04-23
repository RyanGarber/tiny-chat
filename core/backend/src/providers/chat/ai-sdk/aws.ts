import type { AISdkSubprovider } from './index.ts';
import { type BedrockProviderOptions, createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import type { Model } from '../../../types.ts';
import { AnthropicFamily } from '../../../families/anthropic.ts';
import { AnthropicProvider } from './anthropic.ts';
import { AmazonFamily } from '../../../families/amazon.ts';

const INFERENCE_PROFILES: Record<string, string> = {
  'amazon.nova-2-lite-v1:0': 'global.amazon.nova-2-lite-v1:0',
  'anthropic.claude-haiku-4-5-20251001-v1:0': 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  'anthropic.claude-opus-4-5-20251101-v1:0': 'global.anthropic.claude-opus-4-5-20251101-v1:0',
  'anthropic.claude-opus-4-6-v1': 'global.anthropic.claude-opus-4-6-v1',
  'anthropic.claude-sonnet-4-6': 'global.anthropic.claude-sonnet-4-6',
  'anthropic.claude-sonnet-4-20250514-v1:0': 'global.anthropic.claude-sonnet-4-20250514-v1:0',
  'anthropic.claude-sonnet-4-5-20250929-v1:0': 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'cohere.embed-v4:0': 'global.cohere.embed-v4:0',
  'twelvelabs.pegasus-1-2-v1:0': 'global.twelvelabs.pegasus-1-2-v1:0',
};

export const AWSProvider: AISdkSubprovider = {
  name: 'aws',
  settings: ['apiKey'],

  getClient(user) {
    if (!user?.settings?.providers?.aws?.apiKey) return null;
    return createAmazonBedrock({
      region: 'us-east-1',
      apiKey: user.settings.providers.aws.apiKey as string,
    });
  },

  getClientModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createAmazonBedrock>;
    if (!client) return null;

    if (INFERENCE_PROFILES[id]) {
      return client.languageModel(INFERENCE_PROFILES[id]);
    }

    return client.languageModel(id);
  },

  getClientOptions(user, config) {
    if (config.model.includes('claude-')) {
      return {
        bedrock: {
          reasoningConfig: AnthropicProvider.getClientOptions(user, config)?.thinking,
        } satisfies BedrockProviderOptions,
      };
    }

    return {
      bedrock: {
        reasoningConfig: {
          type: config.args?.thinking !== 'none' ? 'enabled' : 'disabled',
          maxReasoningEffort: config.args?.thinking !== 'none' ? config.args?.thinking : undefined,
        },
      } satisfies BedrockProviderOptions,
    };
  },

  async getModels(user) {
    if (!user?.settings?.providers?.aws?.apiKey) return [];

    try {
      const models = (await (
        await fetch('https://bedrock.us-east-1.amazonaws.com/foundation-models', {
          headers: { Authorization: `Bearer ${user.settings.providers.aws.apiKey}` },
        })
      ).json()) as {
        modelSummaries: { modelId: string; outputModalities: ('TEXT' | 'IMAGE' | 'EMBEDDING')[] }[];
      };

      return models.modelSummaries.flatMap((m): Model[] => {
        if (m.modelId.includes('claude-')) {
          return [
            {
              name: m.modelId,
              features: ['generate' as const, 'toolCall' as const],
              args: AnthropicFamily.getArgs(m.modelId),
            } satisfies Model,
          ];
        }

        return [
          {
            name: m.modelId,
            features: m.outputModalities.includes('TEXT')
              ? ['generate' as const, 'toolCall' as const]
              : m.outputModalities.includes('EMBEDDING')
                ? ['embed' as const]
                : [],
            args: AmazonFamily.getArgs(m.modelId),
          } satisfies Model,
        ];
      });
    } catch (e) {
      console.error('Failed to fetch AWS models', e);
      return [];
    }
  },
};
