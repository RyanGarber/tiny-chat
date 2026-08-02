import type {
	LanguageModelV4,
	LanguageModelV4StreamPart,
	ProviderV4,
} from "@ai-sdk/provider";
import {
	type AntigravityAccount,
	AntigravityProxyModel,
} from "@ryangarber/ai-sdk-antigravity-proxy";
import type { TextStreamPart } from "ai";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import type { ModelProvider, zModel } from "../../types/model.ts";
import { ModelProviderUtils } from "../../utils/ModelProviderUtils.ts";
import { GoogleProvider } from "./GoogleProvider.ts";

export const AntigravityProvider: ModelProvider<ProviderV4> = {
	name: "antigravity",
	type: "model",
	settings: ["refreshToken", "projectId", "email"],

	getSdk({ user, env }) {
		if (!user?.settings?.providers?.gemini?.refreshToken) return null;
		console.log(
			`[AntigravityProvider] using relay: ${env.PROVIDER_RELAY_URL}${CommonUtils.endpoints.antigravity}`,
		);
		return createAntigravityProxyRelayProvider(
			`${env.PROVIDER_RELAY_URL}${CommonUtils.endpoints.antigravity}`,
			{
				refreshToken: user.settings.providers.antigravity
					.refreshToken as string,
				projectId: user.settings.providers.antigravity.projectId as string,
				email: user.settings.providers.antigravity.email as string,
				lastUsed: 0,
				tokenUsage: 0,
				healthScore: 100,
			},
		);
	},

	getSdkOptions({ user, config, env }) {
		return GoogleProvider.getSdkOptions({ user, config, env });
	},

	async getStatus({ user }) {
		if (!user?.settings?.providers?.antigravity?.refreshToken)
			return { valid: false, models: [] };

		return {
			valid: true,
			models: AntigravityProxyModel.options.map(
				(name) =>
					({
						name,
						features: ["language", "language:tools"],
						args: this.getModelArgs({ model: name }),
					}) satisfies zModel,
			),
		};
	},

	getModelArgs(model) {
		return GoogleProvider.getModelArgs(model).filter(
			(arg) => arg.name !== "thinking",
		);
	},

	getLanguageModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.languageModel(model) ?? null;
	},

	getEmbeddingModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.embeddingModel(model) ?? null;
	},

	getPartTransformed({ part }) {
		return [
			ModelProviderUtils.getPartTransformed({
				part,
				supportedFileTypes: ["video/", "image/", "application/pdf"],
			}),
		];
	},

	getPartSignature({ user, config, event }) {
		return GoogleProvider.getPartSignature?.({
			user,
			config,
			event: {
				...event,
				...("providerMetadata" in event &&
				event.providerMetadata?.["antigravity-proxy"]
					? {
							providerMetadata: {
								google: event.providerMetadata?.["antigravity-proxy"],
							},
						}
					: {}),
			},
		});
	},

	getPartSignatureReturn({ user, config, part }) {
		return {
			"antigravity-proxy": {
				...GoogleProvider.getPartSignatureReturn?.({ user, config, part })
					?.google,
			},
		};
	},
};

export function createAntigravityProxyRelayProvider(
	url: string,
	account: AntigravityAccount,
): ProviderV4 {
	return {
		specificationVersion: "v4",
		languageModel(modelId: string): LanguageModelV4 {
			return {
				specificationVersion: "v4",
				provider: "antigravity-proxy-relay",
				modelId,
				supportedUrls: {},
				doGenerate() {
					throw new Error("Only streams are supported.");
				},
				async doStream(options) {
					console.log(
						"[AntigravityProxy] calling relay with options:",
						account,
						options,
					);
					const result = await fetch(url, {
						headers: { "X-Antigravity-Account": JSON.stringify(account) },
						method: "POST",
						body: JSON.stringify({
							model: modelId,
							prompt: options.prompt,
							tools: options.tools,
							providerOptions: options.providerOptions,
						}),
					});

					if (!result.ok) throw new Error(`Remote: ${result.status}`);

					let buffer = "";
					const stream = new ReadableStream<LanguageModelV4StreamPart>({
						async start(controller) {
							if (!result.body)
								throw new Error("No response body from Antigravity relay");
							const reader = result.body
								.pipeThrough(new TextDecoderStream())
								.getReader();
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								buffer += value;
								const lines = buffer.split("\n\n");
								buffer = lines.pop() ?? "";
								for (const line of lines) {
									if (!line.startsWith("data: ")) continue;
									const event = JSON.parse(
										line.slice(6),
									) as TextStreamPart<any>;
									if (event.type === "start-step") {
										controller.enqueue({
											type: "stream-start",
											warnings: event.warnings,
										});
									} else if (event.type === "text-start") {
										controller.enqueue({
											type: event.type,
											id: event.id,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "text-delta" && "text" in event) {
										controller.enqueue({
											type: "text-delta",
											id: event.id,
											delta: event.text,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "text-end") {
										controller.enqueue({
											type: "text-end",
											id: event.id,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "reasoning-start") {
										controller.enqueue({
											type: event.type,
											id: event.id,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "reasoning-delta") {
										controller.enqueue({
											type: "reasoning-delta",
											id: event.id,
											delta: event.text,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "reasoning-end") {
										controller.enqueue({
											type: "reasoning-end",
											id: event.id,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "tool-input-start") {
										controller.enqueue({
											type: "tool-input-start",
											id: event.id,
											title: event.title,
											toolName: event.toolName,
											providerMetadata: event.providerMetadata,
											providerExecuted: event.providerExecuted,
											dynamic: event.dynamic,
										});
									} else if (event.type === "tool-input-delta") {
										controller.enqueue({
											type: "tool-input-delta",
											id: event.id,
											delta: event.delta,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "tool-input-end") {
										controller.enqueue({
											type: "tool-input-end",
											id: event.id,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "tool-call") {
										controller.enqueue({
											type: "tool-call",
											toolName: event.toolName,
											toolCallId: event.toolCallId,
											input: JSON.stringify(event.input),
											providerMetadata: event.providerMetadata,
											providerExecuted: event.providerExecuted,
											dynamic: event.dynamic,
										});
									} else if (event.type === "tool-result") {
										controller.enqueue({
											type: "tool-result",
											toolName: event.toolName,
											toolCallId: event.toolCallId,
											dynamic: event.dynamic,
											result: JSON.stringify(event.output),
											isError: false,
											preliminary: event.preliminary,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "tool-error") {
										controller.enqueue({
											type: "tool-result",
											toolName: event.toolName,
											toolCallId: event.toolCallId,
											dynamic: event.dynamic,
											result: JSON.stringify(event.error),
											isError: true,
											providerMetadata: event.providerMetadata,
										});
									} else if (event.type === "error") {
										controller.enqueue({
											type: "error",
											error: event.error,
										});
									} else if (event.type === "finish-step") {
										controller.enqueue({
											type: "finish",
											finishReason: {
												unified: event.finishReason,
												raw: event.rawFinishReason,
											},
											usage: {
												inputTokens: {
													total: event.usage.inputTokens,
													noCache: event.usage.inputTokenDetails.noCacheTokens,
													cacheRead:
														event.usage.inputTokenDetails.cacheReadTokens,
													cacheWrite:
														event.usage.inputTokenDetails.cacheWriteTokens,
												},
												outputTokens: {
													total: event.usage.outputTokens,
													text: event.usage.outputTokenDetails.textTokens,
													reasoning:
														event.usage.outputTokenDetails.reasoningTokens,
												},
											},
											providerMetadata: event.providerMetadata,
										});
									} else if (
										event.type !== "start" &&
										event.type !== "finish"
									) {
										console.warn(`Discarding '${event.type}' part`, event);
									}
								}
							}
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
