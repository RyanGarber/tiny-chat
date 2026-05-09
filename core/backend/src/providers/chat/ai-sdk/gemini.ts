import type { Model } from '../../../types.ts';
import type { AISdkSubprovider } from './index.ts';
import { createGeminiProvider, type GeminiProviderOptions } from 'ai-sdk-provider-gemini-cli';
import { GoogleFamily } from '../../../families/google.ts';
import { GoogleProvider } from './google.ts';

export const GeminiProvider: AISdkSubprovider = {
  name: 'gemini',
  settings: ['refreshToken'],

  getClient(user) {
    if (!user?.settings?.providers?.gemini?.refreshToken) return null;
    return createGeminiProvider({
      authType: 'oauth-personal',
      refreshToken: user.settings.providers.gemini.refreshToken as string,
    } satisfies GeminiProviderOptions & { refreshToken?: string } as GeminiProviderOptions);
  },

  getClientModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createGeminiProvider>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientOptions(user, config) {
    return GoogleProvider.getClientOptions(user, config);
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  async getModels(user) {
    if (!user?.settings?.providers?.gemini?.refreshToken) return [];
    return [
      'gemini-3.1-pro-preview',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ].map(
      (name) =>
        ({
          name,
          features: ['generate', 'toolCall'],
          args: GoogleFamily.getArgs(name),
        }) satisfies Model,
    );
  },
};
