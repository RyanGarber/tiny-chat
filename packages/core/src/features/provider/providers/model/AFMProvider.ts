import type {
	LanguageModelV4,
	LanguageModelV4CallOptions,
	LanguageModelV4FinishReason,
	LanguageModelV4FunctionTool,
	LanguageModelV4StreamPart,
	LanguageModelV4StreamResult,
	ProviderV4,
} from "@ai-sdk/provider";
import type {
	AFMBridge,
	AFMEvent,
	AFMModel,
	AFMRequest,
} from "#core/features/provider/types/afm.ts";
import type {
	ModelProvider,
	zModel,
	zModelArg,
} from "#core/features/provider/types/model.ts";
import { ModelProviderUtils } from "#core/features/provider/utils/ModelProviderUtils.ts";

interface AFMProviderOptions {
	reasoningLevel?: AFMRequest["reasoningLevel"];
}

const toRequest = (
	model: AFMModel,
	options: LanguageModelV4CallOptions,
): AFMRequest => ({
	model,
	temperature: options.temperature,
	maximumResponseTokens: options.maxOutputTokens,
	reasoningLevel: (
		options.providerOptions?.afm as AFMProviderOptions | undefined
	)?.reasoningLevel,
	toolChoice: options.toolChoice?.type,
	tools: options.tools
		?.filter(
			(tool): tool is LanguageModelV4FunctionTool => tool.type === "function",
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
});

const stream = (
	bridge: AFMBridge,
	model: AFMModel,
	options: LanguageModelV4CallOptions,
) =>
	new ReadableStream<LanguageModelV4StreamPart>({
		async start(controller) {
			let activeReasoningId: string | null = null;
			let activeTextId: string | null = null;
			// A cancelled stream still sends its `finish`, after this side has
			// already closed.
			let closed = false;

			const enqueue = (part: LanguageModelV4StreamPart) => {
				if (!closed) controller.enqueue(part);
			};
			const close = () => {
				if (closed) return;
				closed = true;
				controller.close();
			};
			const endReasoning = () => {
				if (!activeReasoningId) return;
				enqueue({ type: "reasoning-end", id: activeReasoningId });
				activeReasoningId = null;
			};
			const endText = () => {
				if (!activeTextId) return;
				enqueue({ type: "text-end", id: activeTextId });
				activeTextId = null;
			};

			const onEvent = (event: AFMEvent) => {
				if (event.type === "stream-start") {
					enqueue({ type: "stream-start", warnings: [] });
				} else if (event.type === "reasoning-delta") {
					if (activeReasoningId !== event.id) {
						endReasoning();
						activeReasoningId = event.id;
						enqueue({ type: "reasoning-start", id: event.id });
					}
					enqueue({
						type: "reasoning-delta",
						id: event.id,
						delta: event.delta,
					});
				} else if (event.type === "text-delta") {
					endReasoning();
					if (activeTextId !== event.id) {
						endText();
						activeTextId = event.id;
						enqueue({ type: "text-start", id: event.id });
					}
					enqueue({ type: "text-delta", id: event.id, delta: event.delta });
				} else if (event.type === "file") {
					enqueue({
						type: "file",
						mediaType: event.mediaType,
						// base64, as afmize writes it
						data: { type: "data", data: event.data },
					});
				} else if (event.type === "tool-call") {
					enqueue({
						type: "tool-input-start",
						id: event.toolCallId,
						toolName: event.toolName,
					});
					enqueue({
						type: "tool-input-delta",
						id: event.toolCallId,
						delta: event.input,
					});
					enqueue({ type: "tool-input-end", id: event.toolCallId });
					enqueue({
						type: "tool-call",
						toolCallId: event.toolCallId,
						toolName: event.toolName,
						input: event.input,
					});
				} else if (event.type === "error") {
					enqueue({ type: "error", error: `${event.code}: ${event.message}` });
				} else if (event.type === "finish") {
					endReasoning();
					endText();
					const usage = event.usage;
					enqueue({
						type: "finish",
						finishReason: {
							unified:
								event.finishReason as LanguageModelV4FinishReason["unified"],
							raw: event.finishReason,
						},
						usage: {
							inputTokens: {
								cacheRead: usage?.cachedInputTokens,
								cacheWrite: undefined,
								noCache: usage && usage.inputTokens - usage.cachedInputTokens,
								total: usage?.inputTokens,
							},
							outputTokens: {
								reasoning: usage?.reasoningTokens,
								text: usage && usage.outputTokens - usage.reasoningTokens,
								total: usage?.outputTokens,
							},
						},
					});
					close();
				}
			};

			const id = await bridge.stream(toRequest(model, options), onEvent);
			if (id < 0) {
				enqueue({ type: "error", error: "afmize rejected the request" });
				close();
				return;
			}

			// The stream is only known by its id once started, so an abort
			// before then is caught up on here.
			const abort = () => {
				void bridge.cancel(id);
				close();
			};
			if (options.abortSignal?.aborted) abort();
			else
				options.abortSignal?.addEventListener("abort", abort, { once: true });
		},
	});

/**
 * Apple Foundation Models through afmize, for any host that can reach it — the
 * host supplies only the {@link AFMBridge}.
 */
export const createAFMProvider = (
	bridge: AFMBridge,
): ModelProvider<ProviderV4> => ({
	name: "apple",
	type: "model",
	settings: [],

	getSdk(): ProviderV4 {
		return {
			specificationVersion: "v4",

			languageModel(modelId: AFMModel): LanguageModelV4 {
				return {
					specificationVersion: "v4",
					provider: "afm",
					modelId,
					supportedUrls: {},
					doStream(options): Promise<LanguageModelV4StreamResult> {
						return Promise.resolve({
							stream: stream(bridge, modelId, options),
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
		let report: { onDevice?: { available?: boolean } };
		try {
			// "{}" when afmize can't encode its report.
			report = JSON.parse(await bridge.availability());
		} catch (error) {
			console.error(error);
			return { valid: false, error: "Failed to initialize", models: [] };
		}

		const availability = {
			onDevice: { available: report.onDevice?.available === true },
			privateCloudCompute: { available: false, reason: "Unsupported" },
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

		return { valid: true, models };
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
});
