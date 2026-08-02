import type {
	FilePart,
	ModelMessage,
	TextPart,
	TextStreamPart,
	ToolCallPart,
	ToolResultPart,
} from "ai";
import type { zAgentEvent } from "../../agent/types/agent.ts";
import {
	Author,
	type zConfig,
	zData,
	zDataInnerPart,
	type zDataPart,
} from "../../data/types/message.ts";
import type { zUser } from "../../data/types/user.ts";
import type { ModelProvider, zModelMessage } from "../types/model.ts";
import { ModelProviderUtils } from "../utils/ModelProviderUtils.ts";

type SdkMessage = ModelMessage & {
	content: Exclude<ModelMessage["content"][number], string>[];
};

export const ModelTransformService = {
	toSdkMessages: ({
		user,
		provider,
		messages,
		config,
	}: {
		user: zUser;
		provider: ModelProvider<any>;
		messages: zModelMessage[];
		config: zConfig;
	}): SdkMessage[] => {
		const sdkMessages: SdkMessage[] = [];
		for (const message of messages) {
			const sdkMessage: SdkMessage = {
				role: message.author === Author.MODEL ? "assistant" : "user",
				content: [],
			};

			const transform = (part: zDataPart) =>
				provider.getPartTransformed?.({ user, config, part }) ??
				ModelProviderUtils.getPartTransformed({ part });
			const parts = zData.parse(message.data).flat().flatMap(transform);

			type SdkInnerPart =
				| TextPart
				| (FilePart & { data: Extract<FilePart["data"], { type: "data" }> });

			const appendUserParts: SdkInnerPart[] = [];

			for (const part of parts) {
				const isToolResult = part.type === "toolResult";
				const isToolRole = sdkMessage.role === "tool";

				// If transitioning between toolResult and non-toolResult blocks, push and reset
				if ((isToolResult && !isToolRole) || (!isToolResult && isToolRole)) {
					sdkMessages.push({ ...sdkMessage });
					sdkMessage.content = [];
				}

				// Correctly assign the author for the current block
				sdkMessage.role = isToolResult
					? "tool"
					: message.author === "MODEL"
						? "assistant"
						: "user";

				let providerOptions = provider.getPartSignatureReturn?.({
					user,
					config,
					part,
				});
				providerOptions =
					ModelProviderUtils.getSignatureReturnPruned(providerOptions);

				const toSdkInnerPart = (part: zDataInnerPart[]): SdkInnerPart[] => {
					return part.flatMap(transform).flatMap((part): SdkInnerPart[] => {
						if (part.type === "text") {
							return [{ type: "text", text: part.value }];
						} else if (part.type === "file") {
							return [
								{
									type: "file",
									filename: part.name,
									mediaType: part.mime,
									data: { type: "data", data: part.data },
								},
							];
						} else if (part.type === "json") {
							return [
								{
									type: "text",
									text: JSON.stringify(part.value),
								},
							];
						}
						console.warn("[ModelTransformService] invalid tool output:", part);
						return [];
					});
				};

				const toSdkPart = (
					part: zDataPart,
				): (
					| TextPart
					| (Omit<TextPart, "type"> & { type: "reasoning" })
					| ToolCallPart
					| ToolResultPart
					| FilePart
				)[] => {
					if (part.type === "text") {
						return [{ type: "text", text: part.value, providerOptions }];
					} else if (part.type === "json") {
						return [
							{
								type: "text",
								text: `\`\`\`json\n${JSON.stringify(part.value, null, 4)}\n\`\`\``,
								providerOptions,
							},
						];
					} else if (part.type === "file") {
						return [
							{
								type: "file",
								filename: part.name,
								mediaType: part.mime,
								data: part.data,
								providerOptions,
							},
						];
					} else if (part.type === "thought") {
						return [
							{
								type: "reasoning",
								text: part.value,
								providerOptions,
							},
						];
					} else if (part.type === "toolCall") {
						return [
							{
								type: "tool-call",
								toolCallId: part.id,
								toolName: part.name,
								input: part.args,
								providerOptions,
							},
						];
					} else if (part.type === "toolResult") {
						const parsed = zDataInnerPart.array().safeParse(part.value);
						// Store for appending in a new user part
						if (part.append) {
							appendUserParts.push(...toSdkInnerPart(part.append));
						}
						return [
							{
								type: "tool-result",
								toolCallId: part.id,
								toolName: part.name,
								output: part.error
									? { type: "error-json", value: part.value }
									: parsed.success
										? {
												type: "content",
												value: toSdkInnerPart(parsed.data),
											}
										: { type: "json", value: part.value },
								providerOptions,
							},
						];
					}
					return [];
				};

				sdkMessage.content.push(...toSdkPart(part));
			}

			if (sdkMessage.content.length) {
				sdkMessages.push(sdkMessage);
			}

			if (appendUserParts.length) {
				sdkMessages.push({
					role: "user",
					content: appendUserParts,
				});
			}
		}

		return sdkMessages;
	},

	fromSdkEvent: ({
		user,
		provider,
		config,
		event,
	}: {
		user: zUser;
		provider: ModelProvider<any>;
		config: zConfig;
		event: TextStreamPart<any>;
	}): zAgentEvent | null => {
		const signature = ModelProviderUtils.getSignaturePruned(
			provider.getPartSignature?.({ user, config, event }),
		);

		if (
			event.type === "reasoning-start" ||
			event.type === "reasoning-delta" ||
			event.type === "reasoning-end"
		) {
			return {
				type: "data",
				value: {
					type: "thought",
					id: event.id,
					value: "text" in event ? event.text : "",
					signature,
				},
			};
		} else if (
			event.type === "text-start" ||
			event.type === "text-delta" ||
			event.type === "text-end"
		) {
			return {
				type: "data",
				value: {
					type: "text",
					id: "id" in event ? event.id : "",
					value: "text" in event ? event.text : "",
					signature,
				},
			};
		} else if (event.type === "file") {
			return {
				type: "data",
				value: {
					type: "file",
					mime: event.file.mediaType,
					data: event.file.base64,
					signature,
				},
			};
		} else if (event.type === "tool-call") {
			return {
				type: "data",
				value: {
					type: "toolCall",
					name: event.toolName,
					id: event.toolCallId,
					args: event.input,
					signature,
				},
			};
		} else if (event.type === "tool-result") {
			return {
				type: "data",
				value: {
					type: "toolResult",
					name: event.toolName,
					id: event.toolCallId,
					value: [
						{
							type: "json",
							value: event.output,
						},
					],
				},
			};
		}

		if (event.type === "finish" && event.finishReason === "error") {
			throw new Error(`${event.finishReason}: ${event.rawFinishReason}`);
		} else if (event.type === "error") {
			throw event.error;
		} else if (
			event.type === "finish" &&
			(event.finishReason === "length" ||
				event.finishReason === "content-filter" ||
				event.finishReason === "other")
		) {
			return {
				type: "data",
				value: {
					type: "abort",
					reason:
						event.finishReason === "content-filter"
							? "content"
							: event.finishReason,
					message:
						"rawFinishReason" in event ? event.rawFinishReason : undefined,
				},
			};
		}

		return null;
	},
} as const;
