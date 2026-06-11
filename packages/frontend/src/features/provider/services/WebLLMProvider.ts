import type { ChatProvider } from '@tiny-chat/shared/src/providers/chat';
import { createWebLLM } from '@browser-ai/web-llm';
import { getBaseModelArgs, getBaseModelTransform } from '@tiny-chat/shared/src/utils';
import type { Model } from '@tiny-chat/shared/src/types/chat';
import { AppConfig, ModelType, prebuiltAppConfig } from '@mlc-ai/web-llm';

export const WebLLMConfig: AppConfig = {
  ...prebuiltAppConfig,
  model_list: prebuiltAppConfig.model_list.map((model) => ({
    ...model,
    overrides: {
      ...model.overrides,
      context_window_size: 16384,
    },
  })),
};

export const WebLLMProvider: ChatProvider = {
  name: 'native',
  settings: [],

  getClient() {
    return createWebLLM();
  },

  getClientGenerateModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createWebLLM>;
    return client.languageModel(id, {
      appConfig: WebLLMConfig,
      engineConfig: { initProgressCallback: console.log, appConfig: WebLLMConfig },
    });
  },

  getClientEmbedModel(user, id, env) {
    const client = this.getClient(user, env) as ReturnType<typeof createWebLLM>;
    return client.embeddingModel(id, {
      appConfig: WebLLMConfig,
      engineConfig: { initProgressCallback: console.log, appConfig: WebLLMConfig },
    });
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
  async getModels() {
    return (WebLLMConfig.model_list.map((model) => ({
      name: model.model_id,
      features:
        model.model_type === ModelType.embedding
          ? ['embed' as const]
          : ['generate' as const, 'toolCall' as const],
      args: this.getModelArgs(model.model_id),
    })) ?? []) satisfies Model[];
  },

  getModelArgs() {
    return getBaseModelArgs(2);
  },
};
