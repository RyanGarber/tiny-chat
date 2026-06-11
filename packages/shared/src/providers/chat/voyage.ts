import { getBaseModelTransform, isModelVersion } from '../../utils.ts';
import type { ChatProvider } from './index.ts';
import { createVoyage } from 'voyage-ai-provider';

const MODEL_IDS = [
  'voyage-3-large',
  'voyage-code-3',
  'voyage-multilingual-2',
  'voyage-law-2',
  'voyage-01',
  'voyage-lite-01',
  'voyage-code-2',
  'voyage-large-2',
  'voyage-large-2-instruct',
  'voyage-lite-02-instruct',
  'voyage-2',
  'voyage-finance-2',
  'voyage-lite-01-instruct',
  'voyage-context-3',
  'voyage-3',
  'voyage-3.5',
  'voyage-4',
  'rerank-1',
  'rerank-2',
  'rerank-2.5',
  'voyage-multimodal-3',
  'voyage-multimodal-3.5',
  'rerank-2-lite',
  'rerank-lite-1',
  'rerank-2.5-lite',
  'voyage-3-lite',
  'voyage-3.5-lite',
  'voyage-4-lite',
  'voyage-4-large',
  'voyage-context-4',
];

export const VoyageProvider: ChatProvider = {
  name: 'voyage',
  settings: ['apiKey'],

  getClient(user) {
    if (!user.settings.providers?.voyage?.apiKey) return null;
    return createVoyage({ apiKey: user.settings.providers.voyage.apiKey });
  },

  getClientGenerateModel(user, _id, env) {
    const client = VoyageProvider.getClient(user, env) as ReturnType<typeof createVoyage>;
    if (!client) return null;
    return null;
  },

  getClientEmbedModel(user, id, env) {
    const client = VoyageProvider.getClient(user, env) as ReturnType<typeof createVoyage>;
    if (!client) return null;
    return client.embeddingModel(id);
  },

  getClientOptions() {
    return {};
  },

  getPartTransformed(_user, _config, _message, part) {
    return [getBaseModelTransform(part)];
  },

  async getModels(user) {
    if (!user.settings.providers?.voyage?.apiKey) return [];

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.settings.providers.voyage.apiKey}`,
      },
      body: JSON.stringify({ input: '1', model: '' }),
    });

    if (response.status === 401) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return MODEL_IDS.map((id) => ({
      name: id,
      features: isModelVersion(id, 'voyage') ? ['embed'] : [],
      args: this.getModelArgs(id),
    }));
  },

  getModelArgs() {
    return [];
  },
};
