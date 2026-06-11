import type { OpenAICompatibleProviderOptions } from '@ai-sdk/openai-compatible';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ChatProvider } from './index.ts';
import { getBaseModelArgs, getBaseModelTransform } from '../../utils.ts';

export const CustomProvider: ChatProvider = {
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

  getClientGenerateModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createOpenAICompatible>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientEmbedModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createOpenAICompatible>;
    if (!client) return null;
    return client.embeddingModel(id);
  },

  getClientOptions(_user, _config) {
    return {} satisfies OpenAICompatibleProviderOptions;
  },

  getPartTransformed(_user, _config, _message, part) {
    return [getBaseModelTransform(part, 'image/', 'application/pdf')];
  },

  async getModels(user) {
    let baseUrl = user?.settings?.providers?.custom?.baseUrl;
    if (!baseUrl) return [];

    if (baseUrl.slice(-1) !== '/') baseUrl = `${baseUrl}/`;

    const apiKey = user.settings.providers!.custom.apiKey;
    const response = await fetch(
      baseUrl + 'models',
      apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {},
    );
    const text = await response.text();
    console.log(`Custom provider response:`, text);
    const json = JSON.parse(text).data as { id: string }[];
    return json.map((model) => {
      return {
        name: model.id,
        features: ['generate' as const, 'toolCall' as const],
        args: this.getModelArgs(model.id),
      };
    });
  },

  getModelArgs() {
    return getBaseModelArgs(-1);
  },
};
