import type { AISdkSubprovider } from './index.ts';
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { Model } from '../../../types.ts';
import { GoogleFamily } from '../../../families/google.ts';

export const GoogleProvider: AISdkSubprovider = {
  name: 'google',
  settings: ['apiKey'],

  getClient(user) {
    if (!user?.settings?.providers?.google?.apiKey) return null;
    return createGoogleGenerativeAI({
      apiKey: user.settings.providers.google.apiKey as string,
    });
  },

  getClientModel(user, id) {
    const client = this.getClient(user) as ReturnType<typeof createGoogleGenerativeAI>;
    if (!client) return null;
    return client.languageModel(id);
  },

  getClientOptions(_user, config) {
    return {
      google: {
        thinkingConfig:
          config.args?.thinking ||
          (config.args?.['thinking-budget'] && config.args['thinking-budget'] !== 'auto')
            ? {
                includeThoughts: true,
                thinkingLevel: config.args?.thinking,
                thinkingBudget:
                  config.args?.['thinking-budget'] && config.args['thinking-budget'] !== 'auto'
                    ? parseInt(config.args['thinking-budget'] as string)
                    : undefined,
              }
            : undefined,
        responseModalities: config.model.includes('gemini-3')
          ? ['TEXT', 'IMAGE', 'AUDIO']
          : undefined,
      } satisfies GoogleGenerativeAIProviderOptions,
    };
  },

  async getModels(user) {
    if (!user?.settings?.providers?.google?.apiKey) return [];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        user.settings.providers.google.apiKey as string,
      )}`,
    );

    const json = (await response.json()) as {
      models: { name: string; supportedGenerationMethods: string[] }[];
    };

    return json.models.map((model) => {
      return {
        name: model.name.split('/').slice(-1)[0],
        features: [
          ...(model.supportedGenerationMethods.includes('generateContent')
            ? ['generate' as const, 'toolCall' as const]
            : []),
          //...(model.name.includes('gemini') ? ['toolCall' as const] : []),
          ...(model.supportedGenerationMethods.includes('embedContent') ? ['embed' as const] : []),
        ],
        args: GoogleFamily.getArgs(model.name),
      } satisfies Model;
    });
  },
};
