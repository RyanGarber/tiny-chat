import { createTestProvider } from '../../services/models/test.ts';
import { getBaseModelArgs } from '../../utils.ts';
import type { ChatProvider } from './index.ts';

export const TestProvider: ChatProvider = {
  name: 'test',
  settings: [],

  getClient() {
    return createTestProvider();
  },

  getClientModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createTestProvider>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientOptions() {
    return {};
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  async getModels() {
    return [
      {
        name: 'test',
        features: ['generate', 'toolCall'],
        args: this.getModelArgs('test'),
      },
    ];
  },

  getModelArgs() {
    return getBaseModelArgs(-1);
  },
};
