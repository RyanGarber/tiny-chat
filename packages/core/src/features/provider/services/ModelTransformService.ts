import type { FilePart, ModelMessage, TextStreamPart } from "ai";
import { z } from "zod";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { AgentMessagesService } from "../../agent/services/AgentMessagesService.ts";
import type { zAgentEvent } from "../../agent/types/agent.ts";
import type { zConfig } from "../../data/types/message.ts";
import { type zDataPart, zDataSimplePart } from "../../data/types/part.ts";
import type { zUser } from "../../data/types/user.ts";
import type { ModelProvider, zModelMessage } from "../types/model.ts";
import { ModelProviderUtils } from "../utils/ModelProviderUtils.ts";

type SdkPart =
	| Exclude<Exclude<ModelMessage["content"][number], string>, FilePart>
	| (FilePart & { data: Extract<FilePart["data"], { type: "data" }> });

type SdkBasicPart = Extract<SdkPart, { type: "text" | "file" }>;

type SdkMessage = ModelMessage & {
	content: SdkPart[];
};

export const ModelTransformService = {
	toSdkMessages: async ({
		user,
		provider,
		messages,
		config,
	}: {
		user: zUser;
		provider: ModelProvider<any>;
		messages: zModelMessage[];
		config: zConfig;
	}): Promise<SdkMessage[]> => {
		const sdkMessages: SdkMessage[] = [];
		for (const message of messages) {
			const sdkMessage: SdkMessage = {
				role: message.author === "MODEL" ? "assistant" : "user",
				content: [],
			};

			// transform based on model: full parts at the root, 'basic' parts for
			// everything inside. Awaited because a document attached to a model
			// that cannot read one is unpacked here.
			async function transform(part: zDataPart): Promise<zDataPart[]>;
			async function transform(
				part: zDataSimplePart,
			): Promise<zDataSimplePart[]>;
			async function transform(
				part: zDataPart,
			): Promise<zDataPart[] | zDataSimplePart[]> {
				let result =
					(await provider.getPartTransformed?.({ user, config, part })) ??
					(await ModelProviderUtils.getPartTransformed({ part }));
				if (!Array.isArray(result)) result = [result];
				return result;
			}

			/** `flatMap` over an async mapper, in order. */
			async function flatMap<T, R>(
				items: T[],
				map: (item: T) => Promise<R[]>,
			): Promise<R[]> {
				return (await Promise.all(items.map(map))).flat();
			}

			const parts = message.data.flat();

			for (const part of parts) {
				const role =
					part.type === "toolResult"
						? "tool"
						: part.type === "interjection"
							? "user"
							: message.author === "MODEL"
								? "assistant"
								: "user";

				// if transitioning between toolResult and non-toolResult blocks, push and reset
				if (sdkMessage.role !== role && sdkMessage.content.length) {
					sdkMessages.push({ ...sdkMessage });
					sdkMessage.content = [];
				}

				// correctly assign the author for the current block
				sdkMessage.role = role;

				let providerOptions = provider.getPartSignatureReturn?.({
					user,
					config,
					part,
				});
				providerOptions =
					ModelProviderUtils.getSignatureReturnPruned(providerOptions);

				// convert to sdk parts with an equivalent basic/non-basic distinction
				async function toSdkPart(part: zDataPart): Promise<SdkPart[]>;
				async function toSdkPart(
					part: zDataSimplePart,
				): Promise<SdkBasicPart[]>;
				async function toSdkPart(
					part: zDataPart,
				): Promise<SdkPart[] | SdkBasicPart[]> {
					if (part.type === "interjection") {
						return await flatMap(
							await flatMap(part.value, transform),
							toSdkPart,
						);
					} else if (part.type === "attachment") {
						return await flatMap(
							await flatMap(
								AgentMessagesService.buildAttachmentParts(part),
								(value) => transform(value),
							),
							(value) => toSdkPart(value),
						);
					} else if (part.type === "text") {
						return [{ type: "text", text: part.value, providerOptions }];
					} else if (part.type === "json") {
						return [
							{
								type: "text",
								text: `\`\`\`json\n${JSON.stringify(part.value)}\n\`\`\``,
								providerOptions,
							},
						];
					} else if (part.type === "file") {
						return [
							{
								type: "file",
								filename: part.name,
								mediaType: part.mime,
								data: { type: "data", data: part.data },
								providerOptions,
							},
						];
					} else {
						if (part.type === "thought") {
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
									input: part.input,
									providerOptions,
								},
							];
						} else if (part.type === "toolResult") {
							const parsed = z.array(zDataSimplePart).safeParse(part.output);
							return [
								{
									type: "tool-result",
									toolCallId: part.id,
									toolName: part.name,
									output: part.error
										? { type: "error-json", value: part.output }
										: parsed.success
											? {
													type: "content",
													value: await flatMap(
														await flatMap(parsed.data, transform),
														toSdkPart,
													),
												}
											: { type: "json", value: part.output },
									providerOptions,
								},
							];
						}
					}
					return [];
				}

				sdkMessage.content.push(
					...(await flatMap(await transform(part), (part) => toSdkPart(part))),
				);
			}

			if (sdkMessage.content.length) {
				sdkMessages.push(sdkMessage);
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
					id: CommonUtils.getRandomId(),
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
					input: event.input,
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
					output: [
						{
							id: CommonUtils.getRandomId(),
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
					id: CommonUtils.getRandomId(),
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
