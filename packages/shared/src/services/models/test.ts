import type { LanguageModelV4, LanguageModelV4StreamPart, ProviderV4 } from '@ai-sdk/provider';

export function createTestProvider(): ProviderV4 {
  return {
    specificationVersion: 'v4',
    languageModel(modelId: string): LanguageModelV4 {
      return {
        specificationVersion: 'v4',
        provider: 'test',
        modelId,
        supportedUrls: {},
        doGenerate() {
          throw new Error('Only streams are supported.');
        },
        // eslint-disable-next-line @typescript-eslint/require-await
        async doStream(options) {
          console.log('Running test model with options:', options);

          const stream = new ReadableStream<LanguageModelV4StreamPart>({
            async start(controller) {
              const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

              controller.enqueue({
                type: 'stream-start',
                warnings: [],
              });
              await sleep(1000);

              const data = options.prompt.slice(-1)[0].content;
              console.log('Data:', data);

              if (typeof data === 'string') throw new Error('Expected object');

              const toolResult = data.find((p) => p.type === 'tool-result');

              if (!toolResult) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: '1',
                  toolName: 'read_file',
                  input: JSON.stringify({
                    path: '~/.zshrc',
                  }),
                });
              } else {
                controller.enqueue({
                  type: 'text-start',
                  id: '1',
                  providerMetadata: {},
                });
                await sleep(1000);

                controller.enqueue({
                  type: 'text-delta',
                  id: '1',
                  delta: `<message role="assistant" model="test-generate">\nDone! 🎉</message>`,
                  providerMetadata: {},
                });
                await sleep(1000);

                controller.enqueue({
                  type: 'text-end',
                  id: '1',
                  providerMetadata: {},
                });
                await sleep(1000);
              }

              controller.enqueue({
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: {
                    total: 0,
                    noCache: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                  outputTokens: {
                    total: 0,
                    text: 0,
                    reasoning: 0,
                  },
                },
                providerMetadata: {},
              });
              controller.close();
            },
          });

          return { stream, rawCall: { rawPrompt: options.prompt, rawSettings: {} } };
        },
      };
    },
    embeddingModel() {
      throw new Error('Only language models are supported.');
    },
    imageModel() {
      throw new Error('Only language models are supported.');
    },
    rerankingModel() {
      throw new Error('Only language models are supported.');
    },
  };
}
