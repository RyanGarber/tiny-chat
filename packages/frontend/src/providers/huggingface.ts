import type { ChatProvider } from '@tiny-chat/shared/src/providers/chat';
import { createTransformersJS } from '@browser-ai/transformers-js';
import { getBaseModelArgs, getBaseModelTransform } from '@tiny-chat/shared/src/utils';
import type { Model } from '@tiny-chat/shared/src/types/chat';

export const HuggingFaceProvider: ChatProvider = {
  name: 'huggingface',
  settings: [],

  getClient() {
    return createTransformersJS();
  },

  getClientModel(user, model, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createTransformersJS>;
    return client.languageModel(model);
  },

  getClientOptions() {
    return {};
  },

  getPartTransformed(_user, _config, _message, part) {
    return [getBaseModelTransform(part)];
  },

  getPartSignature() {
    return undefined;
  },

  getPartSignatureReturn() {
    return undefined;
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  async getModels(user) {
    return (user.settings.huggingFaceModels?.map((model) => ({
      name: model,
      features: ['generate' as const, 'toolCall' as const],
      args: this.getModelArgs(model),
    })) ?? []) satisfies Model[];
  },

  getModelArgs() {
    return getBaseModelArgs(2);
  },
};

export async function getModelCacheSize(modelId: string) {
  if (!('caches' in window)) return null;
  const cache = await caches.open('transformers-cache');
  const keys = await cache.keys();
  const modelFiles = keys.filter((key) => key.url.includes(modelId.replace('/', '/')));
  return modelFiles.length;
}

export async function deleteModelCache(modelId: string) {
  if (!('caches' in window)) return;
  const cache = await caches.open('transformers-cache');
  const keys = await cache.keys();
  for (const key of keys) {
    if (key.url.includes(modelId)) {
      await cache.delete(key);
    }
  }
}
