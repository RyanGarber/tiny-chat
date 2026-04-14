import type { AISdkProvider } from './index.ts';
import { createAzure } from '@ai-sdk/azure';
import type { Model } from '../../../types.ts';
import { getCommonArgs } from '../../../utils/consts.ts';
import { createAnthropic } from '@ai-sdk/anthropic';

const useResponses = (id: string) => ['gpt-', 'o1', 'o3', 'o4'].some((m) => id.includes(m));

export const AzureProvider: AISdkProvider = {
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
  getLanguageModel(user, id) {
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
          const args = getCommonArgs(1);
          if (d.name.includes('claude-4.5')) {
            args.push({
              name: 'thinking',
              type: 'list' as const,
              values: ['disabled', '2500', '5000', '7500', '10000'],
              default: '2500',
            });
          }
          if (d.name.includes('claude-4.6')) {
            args.push({
              name: 'thinking',
              type: 'list' as const,
              values: ['disabled', 'adaptive'],
              default: 'adaptive',
            });
          }
          return {
            name: d.name,
            features: ['generate' as const, 'toolCall' as const],
            args,
          } satisfies Model;
        }

        const reasoning =
          d.name.includes('gpt-5') ||
          d.name.includes('gpt-4o') ||
          d.name.includes('o1') ||
          d.name.includes('o3') ||
          d.name.includes('o4');

        const args = getCommonArgs(reasoning ? -1 : 2);
        if (reasoning) {
          args.push({
            name: 'reasoning',
            type: 'list' as const,
            values: ['low', 'medium', 'high'],
            default: 'medium',
          });
        }
        return {
          name: d.name,
          features: [
            ...(useResponses(d.name) ? ['generate' as const, 'toolCall' as const] : []),
            'embed' as const,
          ],
          args,
        } satisfies Model;
      });
    } catch (e) {
      console.error('Failed to fetch Azure models', e);
      return [];
    }
  },
};
