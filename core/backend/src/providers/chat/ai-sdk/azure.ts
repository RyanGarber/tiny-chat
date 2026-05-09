import type { AISdkSubprovider } from './index.ts';
import { createAzure } from '@ai-sdk/azure';
import type { Model } from '../../../types.ts';
import { createAnthropic } from '@ai-sdk/anthropic';
import { AnthropicProvider } from './anthropic.ts';
import { OpenAIProvider } from './openai.ts';
import { AnthropicFamily } from '../../../families/anthropic.ts';
import { OpenAIFamily } from '../../../families/openai.ts';

const useResponses = (id: string) => ['gpt-', 'o1', 'o3', 'o4'].some((m) => id.includes(m));

export const AzureProvider: AISdkSubprovider = {
  name: 'azure',
  settings: ['resourceId', 'projectId', 'apiKey'],

  getClient(user) {
    const settings = user?.settings?.providers?.azure;
    if (!settings?.resourceId || !settings?.apiKey) return null;
    return createAzure({
      resourceName: settings.resourceId as string,
      apiKey: settings.apiKey as string,
    });
  },

  getClientModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createAzure>;
    if (!client) return null;

    if (id.includes('claude-')) {
      const settings = user?.settings?.providers?.azure;
      return createAnthropic({
        baseURL: `https://${encodeURIComponent(settings.resourceId as string)}.services.ai.azure.com/anthropic/v1`,
        apiKey: settings.apiKey as string,
      }).languageModel(id);
    }

    if (!useResponses(id)) return client.chat(id); // force completions api
    return client.languageModel(id);
  },

  getClientOptions(user, config) {
    if (config.model.includes('claude-')) {
      return AnthropicProvider.getClientOptions(user, config);
    }

    return OpenAIProvider.getClientOptions(user, config);
  },

  async getModels(user) {
    const settings = user?.settings?.providers?.azure;
    if (!settings?.resourceId || !settings?.projectId || !settings?.apiKey) return [];

    try {
      const deployments = await fetch(
        `https://${encodeURIComponent(settings.resourceId as string)}.services.ai.azure.com/api/projects/${encodeURIComponent(settings.projectId as string)}/deployments?api-version=v1`,
        { headers: { Authorization: `Bearer ${settings.apiKey}` } },
      );

      if (!deployments.ok) return [];

      const json = (await deployments.json()) as {
        value: { name: string }[];
      };

      return json.value.map((d) => {
        if (d.name.includes('claude-')) {
          return {
            name: d.name,
            features: ['generate' as const, 'toolCall' as const],
            args: AnthropicFamily.getArgs(d.name),
          } satisfies Model;
        }

        return {
          name: d.name,
          features: useResponses(d.name)
            ? ['generate' as const, 'toolCall' as const]
            : ['generate' as const],
          args: OpenAIFamily.getArgs(d.name),
        } satisfies Model;
      });
    } catch (e) {
      console.error('Failed to fetch Azure models', e);
      return [];
    }
  },
};
