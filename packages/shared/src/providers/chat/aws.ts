import { type BedrockProviderOptions, createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import type { Model, ModelArg } from '../../types/chat.ts';
import { AnthropicProvider } from './anthropic.ts';
import type { ChatProvider } from './index.ts';
import { getBaseModelTransform, isModelVersion } from '../../utils.ts';
import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';

const INFERENCE_PROFILES: Record<string, string> = {
  'amazon.nova-2-lite-v1:0': 'global.amazon.nova-2-lite-v1:0',
  'anthropic.claude-fable-5': 'global.anthropic.claude-fable-5',
  'anthropic.claude-haiku-4-5-20251001-v1:0': 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
  'anthropic.claude-opus-4-5-20251101-v1:0': 'global.anthropic.claude-opus-4-5-20251101-v1:0',
  'anthropic.claude-opus-4-6-v1': 'global.anthropic.claude-opus-4-6-v1',
  'anthropic.claude-sonnet-4-6': 'global.anthropic.claude-sonnet-4-6',
  'anthropic.claude-sonnet-4-20250514-v1:0': 'global.anthropic.claude-sonnet-4-20250514-v1:0',
  'anthropic.claude-sonnet-4-5-20250929-v1:0': 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'cohere.embed-v4:0': 'global.cohere.embed-v4:0',
  'twelvelabs.pegasus-1-2-v1:0': 'global.twelvelabs.pegasus-1-2-v1:0',
};

export const AWSProvider: ChatProvider = {
  name: 'aws',
  settings: ['apiKey'],

  getClient(user) {
    if (!user?.settings?.providers?.aws?.apiKey) return null;
    return createAmazonBedrock({
      region: 'us-east-1',
      apiKey: user.settings.providers.aws.apiKey as string,
    });
  },

  getClientGenerateModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createAmazonBedrock>;
    if (!client) return null;

    if (INFERENCE_PROFILES[id]) id = INFERENCE_PROFILES[id];

    if (isModelVersion(id, 'claude')) {
      const client = createBedrockAnthropic({
        region: 'us-east-1',
        apiKey: user.settings.providers!.aws.apiKey as string,
      });
      return client.languageModel(id);
    }

    return client.languageModel(id);
  },

  getClientEmbedModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createAmazonBedrock>;
    if (!client) return null;
    return client.embeddingModel(id);
  },

  getClientOptions(user, config, env) {
    if (isModelVersion(config.model, 'claude')) {
      return AnthropicProvider.getClientOptions(user, config, env);
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

  getPartTransformed(user, config, message, part) {
    if (isModelVersion(config.model, 'claude')) {
      return AnthropicProvider.getPartTransformed?.(user, config, message, part) ?? [part];
    }

    return [getBaseModelTransform(part)];
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
        if (isModelVersion(m.modelId, 'claude')) {
          return [
            {
              name: m.modelId,
              features: ['generate' as const, 'toolCall' as const],
              args: this.getModelArgs(m.modelId),
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
            args: this.getModelArgs(m.modelId),
          } satisfies Model,
        ];
      });
    } catch (e) {
      console.error('Failed to fetch AWS models', e);
      return [];
    }
  },

  getModelArgs(model) {
    if (isModelVersion(model, 'claude')) {
      return AnthropicProvider.getModelArgs(model);
    }

    const args: ModelArg[] = [];
    if (isModelVersion(model, 'nova')) {
      args.push({
        name: 'thinking',
        type: 'list' as const,
        values: ['none', 'low', 'medium', 'high'],
        default: 'medium',
      });
    }
    return args;
  },
};
