import type {
	LanguageModelV4,
	LanguageModelV4CallOptions,
	LanguageModelV4FunctionTool,
	LanguageModelV4StreamPart,
	LanguageModelV4StreamResult,
	ProviderV4,
} from "@ai-sdk/provider";
import { Channel } from "@tauri-apps/api/core";
import { invoke } from "#frontend/utils/api.ts";
import type { ChatProvider } from "#shared/providers/chat";
import type { Model } from "#shared/types/chat.ts";
import { getBaseModelArgs } from "#shared/utils.ts";

export interface AfmProviderOptions {
	reasoningLevel?: "light" | "moderate" | "deep";
}

export const AFMProvider: ChatProvider = {
	name: "apple",
	settings: [],

	getClient(_user, _env): ProviderV4 {
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
									console.log("invoking stream");

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

	getClientOptions(_user, _config, _env) {
		return {};
	},

	getClientGenerateModel(user, id, env) {
		const client = this.getClient(user, env) as ProviderV4;
		if (!client) return null;

		return client.languageModel(id);
	},

	getClientEmbedModel() {
		return null;
	},

	async getModels(_user): Promise<Model[]> {
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
		return Promise.resolve([
			...(availability.onDevice.available
				? [
						{
							name: "on-device",
							features: ["generate", "toolCall"],
							args: this.getModelArgs("on-device"),
						} satisfies Model,
					]
				: []),
			...(availability.privateCloudCompute.available
				? [
						{
							name: "private-cloud-compute",
							features: ["generate", "toolCall"],
							args: this.getModelArgs("private-cloud-compute"),
						} satisfies Model,
					]
				: []),
		]);
	},

	getModelArgs(id) {
		const args = [...getBaseModelArgs()];
		if (id === "private-cloud-compute") {
			return [
				...args,
				{
					name: "reasoning",
					type: "list",
					values: ["light", "moderate", "deep"],
					default: "moderate",
				},
			];
		}
		return args;
	},
};
