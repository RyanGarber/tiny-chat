import type { Model } from '../../types/chat.ts';
import { GoogleProvider } from './google.ts';
import type { ChatProvider } from './index.ts';
import { createGeminiProvider } from '../../services/models/gemini.ts';
import { getBaseModelTransform } from '../../utils.ts';

export const GeminiProvider: ChatProvider = {
  name: 'gemini',
  settings: ['refreshToken'],

  getClient(user, env) {
    if (!user?.settings?.providers?.gemini?.refreshToken) return null;
    console.log('Using VITE_BACKEND_URL for Gemini:', `${env.VITE_BACKEND_URL}/@/gemini`);
    return createGeminiProvider(
      `${env.VITE_BACKEND_URL}/@/gemini`,
      user.settings.providers.gemini.refreshToken as string,
    );
  },

  getClientGenerateModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createGeminiProvider>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientEmbedModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createGeminiProvider>;
    if (!client) return null;
    return client.embeddingModel(id);
  },

  getClientOptions(user, config, env) {
    return GoogleProvider.getClientOptions(user, config, env);
  },

  getPartTransformed(_user, _config, _message, part) {
    return [getBaseModelTransform(part, 'video/', 'image/', 'application/pdf')];
  },

  getPartSignature(user, config, part) {
    return GoogleProvider.getPartSignature?.(user, config, part);
  },

  getPartSignatureReturn(user, config, message, part) {
    return GoogleProvider.getPartSignatureReturn?.(user, config, message, part);
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  async getModels(user) {
    if (!user?.settings?.providers?.gemini?.refreshToken) return [];
    return [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.5-flash',
    ].map(
      (name) =>
        ({
          name,
          features: ['generate', 'toolCall'],
          args: this.getModelArgs(name),
        }) satisfies Model,
    );
  },

  getModelArgs(model) {
    return GoogleProvider.getModelArgs(model);
  },
};
