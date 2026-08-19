import type { FilePart, ModelMessage, TextStreamPart } from "ai";
import type { zAgentEvent } from "../../agent/types/agent.ts";
import {
	Author,
	type zConfig,
	zData,
	zDataBasicPart,
	type zDataPart,
} from "../../data/types/message.ts";
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
				role: message.author === Author.MODEL ? "assistant" : "user",
				content: [],
			};

			// transform based on model: full parts at the root, 'basic' parts for
			// everything inside. Awaited because a document attached to a model
			// that cannot read one is unpacked here.
			async function transform(part: zDataPart): Promise<zDataPart[]>;
			async function transform(part: zDataBasicPart): Promise<zDataBasicPart[]>;
			async function transform(
				part: zDataPart,
			): Promise<zDataPart[] | zDataBasicPart[]> {
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

			const parts = zData.parse(message.data).flat();
			const appendParts: SdkBasicPart[] = [];

			for (const part of parts) {
				const isToolResult = part.type === "toolResult";
				const isToolRole = sdkMessage.role === "tool";

				// if transitioning between toolResult and non-toolResult blocks, push and reset
				if ((isToolResult && !isToolRole) || (!isToolResult && isToolRole)) {
					sdkMessages.push({ ...sdkMessage });
					sdkMessage.content = [];
				}

				// correctly assign the author for the current block
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

				// convert to sdk parts with an equivalent basic/non-basic distinction
				async function toSdkPart(part: zDataPart): Promise<SdkPart[]>;
				async function toSdkPart(part: zDataBasicPart): Promise<SdkBasicPart[]>;
				async function toSdkPart(
					part: zDataPart,
				): Promise<SdkPart[] | SdkBasicPart[]> {
					if (part.type === "text") {
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
									input: part.args,
									providerOptions,
								},
							];
						} else if (part.type === "toolResult") {
							// Store for appending in a new user part
							if (part.append) {
								appendParts.push(
									...(await flatMap(
										await flatMap(part.append, transform),
										toSdkPart,
									)),
								);
							}
							const parsed = zDataBasicPart.array().safeParse(part.value);
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
													value: await flatMap(
														await flatMap(parsed.data, transform),
														toSdkPart,
													),
												}
											: { type: "json", value: part.value },
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

			if (appendParts.length) {
				sdkMessages.push({
					role: "user",
					content: appendParts,
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
