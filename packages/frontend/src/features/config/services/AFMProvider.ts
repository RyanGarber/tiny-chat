import type {
	LanguageModelV4,
	LanguageModelV4CallOptions,
	LanguageModelV4FunctionTool,
	LanguageModelV4StreamPart,
	LanguageModelV4StreamResult,
	ProviderV4,
} from "@ai-sdk/provider";
import { Channel } from "@tauri-apps/api/core";
import type {
	ModelProvider,
	zModel,
	zModelArg,
} from "@tiny-chat/shared/src/features/provider/types/model.ts";
import { ModelProviderUtils } from "@tiny-chat/shared/src/features/provider/utils/ModelProviderUtils.ts";
import { invoke } from "#frontend/utils/api.ts";

interface AfmProviderOptions {
	reasoningLevel?: "light" | "moderate" | "deep";
}

export const AFMProvider: ModelProvider<ProviderV4> = {
	name: "apple",
	type: "model",
	settings: [],

	getSdk(): ProviderV4 {
		return {
			specificationVersion: "v4",

			languageModel(
				modelId: "on-device" | "private-cloud-compute",
			): LanguageModelV4 {
				return {
					specificationVersion: "v4",
					provider: "afm",
					modelId,
					supportedUrls: {},
					doStream(
						options: LanguageModelV4CallOptions,
					): Promise<LanguageModelV4StreamResult> {
						return Promise.resolve({
							stream: new ReadableStream<LanguageModelV4StreamPart>({
								async start(controller) {
									let streamId: string | null = null;
									let activeReasoningId: string | null = null;
									let activeTextId: string | null = null;

									const events = new Channel<any>();
									events.onmessage = (event) => {
										if (event.type === "stream-start") {
											controller.enqueue({
												type: "stream-start",
												warnings: [],
											});
										} else if (event.type === "reasoning-delta") {
											if (
												!activeReasoningId ||
												activeReasoningId !== event.id
											) {
												activeReasoningId = event.id as string;
												controller.enqueue({
													type: "reasoning-start",
													id: activeReasoningId,
												});
											}
											controller.enqueue({
												type: "reasoning-delta",
												id: activeReasoningId,
												delta: event.delta,
											});
										} else if (event.type === "text-delta") {
											if (activeReasoningId) {
												controller.enqueue({
													type: "reasoning-end",
													id: activeReasoningId,
												});
												activeReasoningId = null;
											}
											if (!activeTextId || activeTextId !== event.id) {
												activeTextId = event.id as string;
												controller.enqueue({
													type: "text-start",
													id: activeTextId,
												});
											}
											controller.enqueue({
												type: "text-delta",
												id: activeTextId,
												delta: event.delta,
											});
										} else if (event.type === "file") {
											controller.enqueue({
												type: "file",
												mediaType: event.mediaType,
												data: event.data,
											});
										} else if (event.type === "tool-call") {
											controller.enqueue({
												type: "tool-input-start",
												id: event.toolCallId,
												toolName: event.toolName,
											});
											controller.enqueue({
												type: "tool-input-delta",
												id: event.toolCallId,
												delta: event.input,
											});
											controller.enqueue({
												type: "tool-input-end",
												id: event.toolCallId,
											});
											controller.enqueue({
												type: "tool-call",
												toolCallId: event.toolCallId,
												toolName: event.toolName,
												input: event.input,
											});
										} else if (event.type === "error") {
											controller.enqueue({
												type: "error",
												error: `${event.code}: ${event.message}`,
											});
										} else if (event.type === "finish") {
											if (activeReasoningId) {
												controller.enqueue({
													type: "reasoning-end",
													id: activeReasoningId,
												});
												activeReasoningId = null;
											}
											if (activeTextId) {
												controller.enqueue({
													type: "text-end",
													id: activeTextId,
												});
												activeTextId = null;
											}
											controller.enqueue({
												type: "finish",
												finishReason: {
													unified: event.finishReason,
													raw: event.finishReason,
												},
												usage: {
													inputTokens: {
														cacheRead: event.usage?.cachedInputTokens,
														cacheWrite: undefined,
														noCache:
															event.usage?.inputTokens -
															event.usage?.cachedInputTokens,
														total: event.usage?.inputTokens,
													},
													outputTokens: {
														reasoning: event.usage?.reasoningTokens,
														text:
															event.usage?.outputTokens -
															event.usage?.reasoningTokens,
														total: event.usage?.outputTokens,
													},
												},
											});
											controller.close();
										}

										if (options.abortSignal?.aborted) {
											void invoke("afm_cancel", { stream_id: streamId });
											controller.close();
										}
									};

									streamId = await invoke<string>("afm_stream", {
										request: {
											model: modelId,
											temperature: options.temperature,
											maximumResponseTokens: options.maxOutputTokens,
											reasoningLevel: (
												options.providerOptions?.afm as
													| AfmProviderOptions
													| undefined
											)?.reasoningLevel,
											toolChoice: options.toolChoice?.type,
											tools: options.tools
												?.filter(
													(tool): tool is LanguageModelV4FunctionTool =>
														tool.type === "function",
												)
												.map((tool) => ({
													name: tool.name,
													description: tool.description,
													inputSchema: tool.inputSchema,
												})),
											messages: options.prompt.map((message) => ({
												role: message.role,
												parts:
													typeof message.content === "string"
														? [{ type: "text", text: message.content }]
														: message.content.flatMap((part) => {
																if (part.type === "reasoning") {
																	return { type: "reasoning", text: part.text };
																} else if (part.type === "text") {
																	return { type: "text", text: part.text };
																} else if (part.type === "file") {
																	return {
																		type: "file",
																		mediaType: part.mediaType,
																		data: part.data,
																	};
																} else if (part.type === "tool-call") {
																	return {
																		type: "tool-call",
																		toolCallId: part.toolCallId,
																		toolName: part.toolName,
																		input: part.input,
																	};
																} else if (part.type === "tool-result") {
																	return {
																		type: "tool-result",
																		toolCallId: part.toolCallId,
																		toolName: part.toolName,
																		output: part.output,
																	};
																}
																return [];
															}),
											})),
										},
										onEventChannel: events,
									});
								},
							}),
						});
					},
					doGenerate() {
						throw new Error("Only streams are supported.");
					},
				};
			},
			embeddingModel() {
				throw new Error("Only language models are supported.");
			},
			imageModel() {
				throw new Error("Only language models are supported.");
			},
		};
	},

	getSdkOptions() {
		return {};
	},

	getLanguageModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.languageModel(model) ?? null;
	},

	getEmbeddingModel({ user, model, env }) {
		return this.getSdk({ user, model, env })?.embeddingModel(model) ?? null;
	},

	async getStatus() {
		/*const availability = await invoke<{
      onDevice: { available: boolean };
      privateCloudCompute: { available: boolean; reason: string };
    }>('afm_availability');*/
		const availability = {
			onDevice: {
				available: true,
			},
			privateCloudCompute: {
				available: false,
			},
		};

		const models: zModel[] = [];

		if (availability.onDevice.available) {
			models.push({
				name: "on-device",
				features: ["language", "language:tools"],
				args: this.getModelArgs({ model: "on-device" }),
			});
		}

		if (availability.privateCloudCompute.available) {
			models.push({
				name: "private-cloud-compute",
				features: ["language", "language:tools"],
				args: this.getModelArgs({ model: "private-cloud-compute" }),
			});
		}

		return {
			valid: true,
			models,
		};
	},

	getModelArgs({ model }) {
		const args: zModelArg[] = ModelProviderUtils.getModelArgs({});

		if (model === "private-cloud-compute") {
			args.push({
				name: "reasoning",
				type: "list",
				values: ["light", "moderate", "deep"],
				default: "moderate",
			});
		}

		return args;
	},
};
