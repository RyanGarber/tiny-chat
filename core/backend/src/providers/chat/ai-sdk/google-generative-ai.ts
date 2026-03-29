import type { AISdkProvider } from './index.ts';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { Model } from '../../../types.ts';
import { getCommonArgs } from '../../../utils/consts.ts';

export const GoogleGenerativeAIProvider: AISdkProvider = {
  name: 'google-ai-studio',
  settings: ['apiKey'],
  getClient(user) {
    if (!user?.settings?.providers?.['google-ai-studio']?.apiKey) return null;
    return createGoogleGenerativeAI({
      apiKey: user.settings.providers['google-ai-studio'].apiKey as string,
    });
  },
  async getModels(user) {
    if (!user?.settings?.providers?.['google-ai-studio']?.apiKey) return [];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        user.settings.providers['google-ai-studio'].apiKey as string,
      )}`,
    );

    const json = (await response.json()) as {
      models: { name: string; supportedGenerationMethods: string[] }[];
    };

    return json.models.map((model) => {
      const args = getCommonArgs(2);
      if (model.name.includes('gemini-2.5')) {
        args.push({
          name: 'thinking-budget',
          type: 'list',
          values: ['auto', '0', '2500', '5000', '7500', '10000'],
          default: 'auto',
        });
      }
      if (model.name.includes('gemini-3')) {
        args.push({
          name: 'thinking',
          type: 'list',
          values: ['minimal', 'low', 'medium', 'high'],
          default: 'medium',
        });
      }
      return {
        name: model.name.split('/').slice(-1)[0],
        features: [
          ...(model.supportedGenerationMethods.includes('generateContent')
            ? ['generate' as const]
            : []),
          ...(model.name.includes('gemini') ? ['toolCall' as const] : []),
          ...(model.supportedGenerationMethods.includes('embedContent') ? ['embed' as const] : []),
        ],
        args,
      } satisfies Model;
    });
  },
};
