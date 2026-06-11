import { createTestProvider } from '../../services/models/test.ts';
import { getBaseModelArgs } from '../../utils.ts';
import type { ChatProvider } from './index.ts';

export const TestProvider: ChatProvider = {
  name: 'test',
  settings: [],

  getClient() {
    return createTestProvider();
  },

  getClientGenerateModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createTestProvider>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientEmbedModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createTestProvider>;
    if (!client) return null;
    return client.embeddingModel(id);
  },

  getClientOptions() {
    return {};
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  async getModels() {
    return [
      {
        name: 'test-generate',
        features: ['generate', 'toolCall'],
        args: this.getModelArgs('test-generate'),
      },
      {
        name: 'test-embed',
        features: ['embed'],
        args: this.getModelArgs('test-embed'),
      },
    ];
  },

  getModelArgs() {
    return getBaseModelArgs(-1);
  },
};
