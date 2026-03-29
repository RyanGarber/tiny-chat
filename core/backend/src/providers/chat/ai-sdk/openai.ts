import type { AISdkProvider } from './index.ts';
import { createOpenAI } from '@ai-sdk/openai';
import OpenAI from 'openai';
import type { Model } from '../../../types.ts';
import { getCommonArgs } from '../../../utils/consts.ts';

export const OpenAIProvider: AISdkProvider = {
  name: 'openai',
  settings: ['apiKey'],
  getClient(user) {
    const apiKey = user?.settings?.providers?.openai?.apiKey;
    if (!apiKey) return null;
    return createOpenAI({
      apiKey: apiKey as string,
    });
  },
  async getModels(user) {
    const apiKey = user?.settings?.providers?.openai?.apiKey;
    if (!apiKey) return [];

    const client = new OpenAI({ apiKey: apiKey as string });

    const models = await client.models.list();

    return models.data
      .filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o1-') || m.id.startsWith('o3-'))
      .map((m) => {
        const reasoning =
          m.id.includes('gpt-5') ||
          m.id.includes('gpt-4o') ||
          m.id.includes('o1') ||
          m.id.includes('o3');
        const args = getCommonArgs(reasoning ? -1 : 2);
        if (reasoning) {
          args.push({
            name: 'reasoning',
            type: 'list',
            values: ['low', 'medium', 'high'],
            default: 'medium',
          });
        }
        return {
          name: m.id,
          features: ['generate' as const, 'toolCall' as const, 'embed' as const],
          args,
        } satisfies Model;
      });
  },
};
