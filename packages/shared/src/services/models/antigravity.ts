import type { ObjectStreamPart, TextStreamPart } from 'ai';
import type { LanguageModelV3, LanguageModelV3StreamPart, ProviderV3 } from '@ai-sdk/provider';
import type { AntigravityAccount } from '@ryangarber/ai-sdk-antigravity-proxy';

export function createAntigravityProxyRelayProvider(
  url: string,
  account: AntigravityAccount,
): ProviderV3 {
  return {
    specificationVersion: 'v3',
    languageModel(modelId: string): LanguageModelV3 {
      return {
        specificationVersion: 'v3',
        provider: 'antigravity-proxy-relay',
        modelId,
        supportedUrls: {},
        doGenerate() {
          throw new Error('Only streams are supported.');
        },
        async doStream(options) {
          console.log('Calling Antigravity relay with options:', account, options);
          const result = await fetch(url, {
            headers: { 'X-Antigravity-Account': JSON.stringify(account) },
            method: 'POST',
            body: JSON.stringify({
              model: modelId,
              prompt: options.prompt,
              tools: options.tools,
              providerOptions: options.providerOptions,
            }),
          });

          if (!result.ok) throw new Error(`Remote: ${result.status}`);

          let buffer = '';
          const stream = new ReadableStream<LanguageModelV3StreamPart>({
            async start(controller) {
              const reader = result.body!.pipeThrough(new TextDecoderStream()).getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += value;
                const lines = buffer.split('\n\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const event = JSON.parse(line.slice(6)) as
                    | TextStreamPart<any>
                    | ObjectStreamPart<any>;
                  if (event.type === 'start-step') {
                    controller.enqueue({
                      type: 'stream-start',
                      warnings: event.warnings,
                    });
                  } else if (event.type === 'text-start') {
                    controller.enqueue({
                      type: event.type,
                      id: event.id,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'text-delta' && 'text' in event) {
                    controller.enqueue({
                      type: 'text-delta',
                      id: event.id,
                      delta: event.text,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'text-end') {
                    controller.enqueue({
                      type: 'text-end',
                      id: event.id,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'reasoning-start') {
                    controller.enqueue({
                      type: event.type,
                      id: event.id,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'reasoning-delta') {
                    controller.enqueue({
                      type: 'reasoning-delta',
                      id: event.id,
                      delta: event.text,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'reasoning-end') {
                    controller.enqueue({
                      type: 'reasoning-end',
                      id: event.id,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'tool-input-start') {
                    controller.enqueue({
                      type: 'tool-input-start',
                      id: event.id,
                      title: event.title,
                      toolName: event.toolName,
                      providerMetadata: event.providerMetadata,
                      providerExecuted: event.providerExecuted,
                      dynamic: event.dynamic,
                    });
                  } else if (event.type === 'tool-input-delta') {
                    controller.enqueue({
                      type: 'tool-input-delta',
                      id: event.id,
                      delta: event.delta,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'tool-input-end') {
                    controller.enqueue({
                      type: 'tool-input-end',
                      id: event.id,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'tool-call') {
                    controller.enqueue({
                      type: 'tool-call',
                      toolName: event.toolName,
                      toolCallId: event.toolCallId,
                      input: JSON.stringify(event.input),
                      providerMetadata: event.providerMetadata,
                      providerExecuted: event.providerExecuted,
                      dynamic: event.dynamic,
                    });
                  } else if (event.type === 'tool-result') {
                    controller.enqueue({
                      type: 'tool-result',
                      toolName: event.toolName,
                      toolCallId: event.toolCallId,
                      dynamic: event.dynamic,
                      result: JSON.stringify(event.output),
                      isError: false,
                      preliminary: event.preliminary,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'tool-error') {
                    controller.enqueue({
                      type: 'tool-result',
                      toolName: event.toolName,
                      toolCallId: event.toolCallId,
                      dynamic: event.dynamic,
                      result: JSON.stringify(event.error),
                      isError: true,
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type === 'error') {
                    controller.enqueue({
                      type: 'error',
                      error: event.error,
                    });
                  } else if (event.type === 'finish-step') {
                    controller.enqueue({
                      type: 'finish',
                      finishReason: { unified: event.finishReason, raw: event.rawFinishReason },
                      usage: {
                        inputTokens: {
                          total: event.usage.inputTokens,
                          noCache: event.usage.inputTokenDetails.noCacheTokens,
                          cacheRead: event.usage.inputTokenDetails.cacheReadTokens,
                          cacheWrite: event.usage.inputTokenDetails.cacheWriteTokens,
                        },
                        outputTokens: {
                          total: event.usage.outputTokens,
                          text: event.usage.outputTokenDetails.textTokens,
                          reasoning: event.usage.outputTokenDetails.reasoningTokens,
                        },
                      },
                      providerMetadata: event.providerMetadata,
                    });
                  } else if (event.type !== 'start' && event.type !== 'finish') {
                    console.warn(`Discarding '${event.type}' part`, event);
                  }
                }
              }
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
