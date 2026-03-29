import type { AISdkProvider } from './index.ts';
import { createAzure } from '@ai-sdk/azure';
import type { Model } from '../../../types.ts';
import { getCommonArgs } from '../../../utils/consts.ts';

export const AzureProvider: AISdkProvider = {
  name: 'microsoft-foundry',
  settings: ['resourceId', 'projectId', 'apiKey'],
  getClient(user) {
    const settings = user?.settings?.providers?.['microsoft-foundry'];
    if (!settings?.resourceId || !settings?.apiKey) return null;
    return createAzure({
      resourceName: settings.resourceId as string,
      apiKey: settings.apiKey as string,
    });
  },
  async getModels(user) {
    const settings = user?.settings?.providers?.['microsoft-foundry'];
    if (!settings?.resourceId || !settings?.projectId || !settings?.apiKey) return [];

    try {
      const deployments = await fetch(
        `https://${encodeURIComponent(settings.resourceId as string)}.services.ai.azure.com/api/projects/${encodeURIComponent(settings.projectId as string)}/deployments?api-version=v1`,
        { headers: { Authorization: `Bearer ${settings.apiKey}` } },
      );

      if (!deployments.ok) return [];

      const json = (await deployments.json()) as {
        value: { name: string; capabilities: Record<string, unknown> }[];
      };

      return json.value.map((d) => {
        const reasoning =
          d.name.includes('gpt-5') ||
          d.name.includes('gpt-4o') ||
          d.name.includes('o1') ||
          d.name.includes('o3');
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
            ...(d.capabilities.chat_completion ? ['generate' as const, 'toolCall' as const] : []),
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
