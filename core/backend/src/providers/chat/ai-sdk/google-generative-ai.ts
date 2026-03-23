import type { AISdkProvider } from './index.ts';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { Model, ModelArg } from '../../../types.ts';

export const GoogleGenerativeAIProvider: AISdkProvider = {
  name: 'google-generative-ai',
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
      const args: ModelArg[] = [
        { name: 'temperature', type: 'range', min: 0, max: 2, step: 0.05, default: 1 },
        ...(model.name.includes('gemini-2.5')
          ? [
              {
                name: 'thinking',
                type: 'list',
                values: ['off', 'low', 'medium', 'high', 'auto'],
                default: 'auto',
              } as ModelArg,
            ]
          : []),
        ...(model.name.includes('gemini-3')
          ? [
              {
                name: 'thinking',
                type: 'list',
                values: ['minimal', 'low', 'medium', 'high', 'auto'],
                default: 'auto',
              } as ModelArg,
            ]
          : []),
      ];
      return {
        name: model.name.split('/').slice(-1)[0],
        features: [
          ...(model.supportedGenerationMethods.includes('generateContent')
            ? ['generate' as const]
            : []),
          ...(model.supportedGenerationMethods.includes('embedContent') ? ['embed' as const] : []),
        ],
        args,
      } satisfies Model;
    });
  },
};
