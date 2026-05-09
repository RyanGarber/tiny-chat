import { type AISdkSubprovider } from './index.ts';
import type { OpenAICompatibleProviderOptions } from '@ai-sdk/openai-compatible';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getCommonArgs } from '../../../utils/consts.ts';

export const CustomProvider: AISdkSubprovider = {
  name: 'custom',
  settings: ['baseUrl', 'apiKey'],

  getClient(user) {
    if (!user?.settings?.providers?.custom?.baseUrl) return null;
    return createOpenAICompatible({
      name: 'custom',
      baseURL: user.settings.providers.custom.baseUrl,
      apiKey: user.settings.providers.custom.apiKey,
    });
  },

  getClientModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createOpenAICompatible>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientOptions(_user, _config) {
    return {} satisfies OpenAICompatibleProviderOptions;
  },

  async getModels(user) {
    let baseUrl = user?.settings?.providers?.custom?.baseUrl;
    if (!baseUrl) return [];

    if (baseUrl.slice(-1) !== '/') baseUrl = `${baseUrl}/`;

    const apiKey = user.settings.providers.custom.apiKey;
    const response = await fetch(
      baseUrl + 'models',
      apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {},
    );
    const json = (await response.json()).data as { id: string }[];
    return json.map((model) => {
      return {
        name: model.id,
        features: ['generate' as const, 'toolCall' as const],
        args: getCommonArgs(-1),
      };
    });
  },
};
