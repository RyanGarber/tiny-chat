import type { Model } from '../../types/chat.ts';
import { GoogleProvider } from './google.ts';
import type { ChatProvider } from './index.ts';
import { getBaseModelTransform } from '../../utils.ts';
import { createAntigravityProxyRelayProvider } from '../../services/models/antigravity.ts';
import { AntigravityProxyModel } from '@ryangarber/ai-sdk-antigravity-proxy';

export const AntigravityProvider: ChatProvider = {
  name: 'antigravity',
  settings: ['refreshToken', 'projectId', 'email'],

  getClient(user, env) {
    if (!user?.settings?.providers?.gemini?.refreshToken) return null;
    console.log('Using VITE_BACKEND_URL for Antigravity:', `${env.VITE_BACKEND_URL}/@/antigravity`);
    return createAntigravityProxyRelayProvider(`${env.VITE_BACKEND_URL}/@/antigravity`, {
      refreshToken: user.settings.providers.antigravity.refreshToken as string,
      projectId: user.settings.providers.antigravity.projectId as string,
      email: user.settings.providers.antigravity.email as string,
      lastUsed: 0,
      tokenUsage: 0,
      healthScore: 100,
    });
  },

  getClientGenerateModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<
      typeof createAntigravityProxyRelayProvider
    >;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientEmbedModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<
      typeof createAntigravityProxyRelayProvider
    >;
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
    return GoogleProvider.getPartSignature?.(user, config, {
      ...part,
      ...('providerMetadata' in part && part.providerMetadata?.google
        ? { providerMetadata: { 'antigravity-proxy': part.providerMetadata?.google } }
        : {}),
    });
  },

  getPartSignatureReturn(user, config, message, part) {
    return {
      'antigravity-proxy': {
        ...GoogleProvider.getPartSignatureReturn?.(user, config, message, part)?.google,
      },
    };
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  async getModels(user) {
    if (!user?.settings?.providers?.antigravity?.refreshToken) return [];
    return AntigravityProxyModel.options.map(
      (name) =>
        ({
          name,
          features: ['generate', 'toolCall'],
          args: this.getModelArgs(name),
        }) satisfies Model,
    );
  },

  getModelArgs(model) {
    return GoogleProvider.getModelArgs(model).filter((arg) => arg.name !== 'thinking');
  },
};
