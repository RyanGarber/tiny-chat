import type {
	LanguageModelV4,
	LanguageModelV4StreamPart,
	ProviderV4,
} from "@ai-sdk/provider";
import type { ModelProvider } from "../../types/model.ts";
import { ModelProviderUtils } from "../../utils/ModelProviderUtils.ts";

export const TestProvider: ModelProvider<ProviderV4> = {
	name: "test",
	type: "model",
	settings: [],

	getSdk() {
		return createTestProvider();
	},

	getLanguageModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.languageModel(model) ?? null;
	},

	getEmbeddingModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.embeddingModel(model) ?? null;
	},

	getSdkOptions() {
		return {};
	},

	async getStatus() {
		return {
			valid: true,
			models: [
				{
					name: "test-generate",
					features: ["language", "language:tools"],
					args: this.getModelArgs({ model: "test-generate" }),
				},
				{
					name: "test-embed",
					features: ["embedding"],
					args: this.getModelArgs({ model: "test-embed" }),
				},
			],
		};
	},

	getModelArgs() {
		return ModelProviderUtils.getModelArgs({ maxTemp: -1 });
	},
};

export function createTestProvider(): ProviderV4 {
	return {
		specificationVersion: "v4",
		languageModel(modelId: string): LanguageModelV4 {
			return {
				specificationVersion: "v4",
				provider: "test",
				modelId,
				supportedUrls: {},
				doGenerate() {
					throw new Error("Only streams are supported.");
				},
				async doStream(options) {
					const stream = new ReadableStream<LanguageModelV4StreamPart>({
						async start(controller) {
							const sleep = (ms: number) =>
								new Promise((resolve) => setTimeout(resolve, ms));

							controller.enqueue({
								type: "stream-start",
								warnings: [],
							});
							await sleep(1000);

							const data = options.prompt.slice(-1)[0].content;
							console.log("[TestProvider] last message:", data);

							if (typeof data === "string") throw new Error("Expected object");

							const toolResult = data.find((p) => p.type === "tool-result");

							if (!toolResult) {
								controller.enqueue({
									type: "tool-call",
									toolCallId: "1",
									toolName: "chat_read_dir",
									input: JSON.stringify({
										path: "/mnt/chat",
									}),
								});
							} else {
								controller.enqueue({
									type: "text-start",
									id: "1",
									providerMetadata: {},
								});
								await sleep(1000);

								controller.enqueue({
									type: "text-delta",
									id: "1",
									delta: `<message role="assistant" model="test-generate">\nDone! 🎉</message>`,
									providerMetadata: {},
								});
								await sleep(1000);

								controller.enqueue({
									type: "text-end",
									id: "1",
									providerMetadata: {},
								});
								await sleep(1000);
							}

							controller.enqueue({
								type: "finish",
								finishReason: { unified: "stop", raw: "stop" },
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

					return {
						stream,
						rawCall: { rawPrompt: options.prompt, rawSettings: {} },
					};
				},
			};
		},
		embeddingModel() {
			throw new Error("Only language models are supported.");
		},
		imageModel() {
			throw new Error("Only language models are supported.");
		},
		rerankingModel() {
			throw new Error("Only language models are supported.");
		},
	};
}
