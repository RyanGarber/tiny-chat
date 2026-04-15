import type { AISdkProvider } from './index.ts';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import type { Model } from '../../../types.ts';
import { getCommonArgs } from '../../../utils/consts.ts';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

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

export const AWSProvider: AISdkProvider = {
  name: 'aws',
  settings: ['apiKey'],
  getClient(user) {
    if (!user?.settings?.providers?.aws?.apiKey) return null;
    return createAmazonBedrock({
      region: 'us-east-1',
      apiKey: user.settings.providers.aws.apiKey as string,
    });
  },
  getLanguageModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createAmazonBedrock>;
    if (!client) return null;

    if (INFERENCE_PROFILES[id]) {
      return client.languageModel(INFERENCE_PROFILES[id]);
    }

    return client.languageModel(id);
  },
  async getModels(user) {
    if (!user?.settings?.providers?.aws?.apiKey) return [];

    try {
      const client = new BedrockClient({
        region: 'us-east-1',
      });

      process.env.AWS_BEARER_TOKEN_BEDROCK = user.settings.providers.aws.apiKey; // TODO
      const foundation = await client.send(new ListFoundationModelsCommand());

      return foundation.modelSummaries!.flatMap((m): Model[] => {
        if (!m.modelId) return [];

        if (m.modelId?.includes('claude-')) {
          const args = getCommonArgs(1);
          if (m.modelId.includes('claude-4.5')) {
            args.push({
              name: 'thinking',
              type: 'list' as const,
              values: ['disabled', '2500', '5000', '7500', '10000'],
              default: '2500',
            });
          }
          if (m.modelId.includes('claude-4.6')) {
            args.push({
              name: 'thinking',
              type: 'list' as const,
              values: ['disabled', 'adaptive'],
              default: 'adaptive',
            });
          }
          return [
            {
              name: m.modelId,
              features: ['generate' as const, 'toolCall' as const],
              args,
            } satisfies Model,
          ];
        }

        const openaiReasoning =
          m.modelId.includes('gpt-5') ||
          m.modelId.includes('gpt-4o') ||
          m.modelId.includes('o1') ||
          m.modelId.includes('o3') ||
          m.modelId.includes('o4');

        const args = getCommonArgs(openaiReasoning ? -1 : 2);
        if (openaiReasoning) {
          args.push({
            name: 'reasoning',
            type: 'list' as const,
            values: ['low', 'medium', 'high'],
            default: 'medium',
          });
        }
        return [
          {
            name: m.modelId,
            features: ['generate' as const, 'toolCall' as const],
            args,
          } satisfies Model,
        ];
      });
    } catch (e) {
      console.error('Failed to fetch AWS models', e);
      return [];
    }
  },
};
