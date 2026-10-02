import { parsePartialJson } from "ai";
import type { z } from "zod";
import type { Capabilities } from "../../../core/types/capability.ts";
import type { zEnv } from "../../../core/types/env.ts";
import type { StreamMutation } from "../../../core/types/stream.ts";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { VERBOSE } from "../../../logger.ts";
import type { zConfig } from "../../data/types/message.ts";
import type {
	zData,
	zDataPart,
	zInterjectionPart,
	zMetadata,
	zToolCallPart,
	zToolResultPart,
} from "../../data/types/part.ts";
import {
	ModelProviderService,
	type RunLanguageModelOptions,
} from "../../provider/services/ModelProviderService.ts";
import type { ModelProvider } from "../../provider/types/model.ts";
import type { zSkill } from "../../skill/types/skill.ts";
import type { Tool, ToolDefinition, Toolset } from "../../tool/types/tool.ts";
import { ToolCallUtils } from "../../tool/utils/ToolCallUtils.ts";
import { ToolUtils } from "../../tool/utils/ToolUtils.ts";
import type { zAgentContext, zAgentEvent } from "../types/agent.ts";
import { AgentUtils } from "../utils/AgentUtils.ts";
import { AgentInstructionsService } from "./AgentInstructionsService.ts";
import { AgentMessagesService } from "./AgentMessagesService.ts";
import {
	AgentTokensService,
	type CompactionResult,
} from "./AgentTokensService.ts";

/** How often a streaming tool call's partial input is re-parsed. */
const PARTIAL_INPUT_MS = 50;

export const AgentService = {
	build: async ({
		context,
		capabilities,
		toolsets,
		skills,
		skipInstructions,
	}: {
		context: zAgentContext;
		capabilities: Capabilities;
		toolsets: Toolset<any>[];
		skills: zSkill[];
		skipInstructions?: boolean;
	}) => {
		const { prompt } = AgentUtils.getLastPrompt({
			messages: context.messages,
			withText: false,
		});

		const enabledToolsets = toolsets.filter(
			(toolset) =>
				toolset.status.valid &&
				prompt?.config?.toolsets?.includes(ToolUtils.name({ toolset })),
		);
		if (VERBOSE) console.log("[AgentService] enabled tools:", enabledToolsets);
		const enabledSkills = skills.filter(
			(skill) => skill.name && prompt?.config?.skills?.includes(skill.path),
		);
		if (VERBOSE) console.log("[AgentService] enabled skills:", enabledSkills);
		const enabledTools = enabledToolsets.flatMap((toolset) =>
			toolset.tools
				.map((tool) => ({
					...tool,
					name: ToolUtils.name({ toolset, tool }),
				}))
				.filter((tool) => context.interactive || !tool.feedback),
		);

		const { messages, customInstructions } =
			await AgentMessagesService.buildMessages({
				context,
				capabilities,
			});

		const instructions = skipInstructions
			? undefined
			: (customInstructions ??
				(await AgentInstructionsService.buildInstructions({
					context,
					config: prompt?.config,
					capabilities,
					enabledToolsets,
					enabledSkills,
				})));

		if (VERBOSE)
			console.log("[AgentService] built agent:", { messages, instructions });

		return {
			config: prompt?.config,
			enabledToolsets,
			enabledTools,
			messages,
			instructions,
		};
	},

	estimate: async ({
		context,
		capabilities,
		config,
		toolsets,
		skills,
		supportsTools = true,
		skipInstructions,
	}: {
		context: zAgentContext;
		capabilities: Capabilities;
		config: zConfig;
		toolsets: Toolset<any>[];
		skills: zSkill[];
		supportsTools?: boolean;
		skipInstructions?: boolean;
	}): Promise<CompactionResult> => {
		const { messages, instructions, enabledTools } = await AgentService.build({
			context,
			capabilities,
			toolsets,
			skills,
			skipInstructions,
		});

		return await AgentTokensService.compactMessages({
			messages,
			instructions,
			config,
			tools: supportsTools ? enabledTools : [],
		});
	},

	generate: async function* ({
		provider,
		context,
		capabilities,
		toolsets,
		skills,
		data,
		metadata,
		env,
		instructions: instructionOverride,
		options,
		toolStream,
		toolSignal,
		interjections,
	}: {
		provider: ModelProvider<any>;
		context: zAgentContext;
		capabilities: Capabilities;
		toolsets: Toolset<any>[];
		skills: zSkill[];
		data: zData;
		metadata: zMetadata;
		env: Partial<zEnv>;
		/** Override the normal chat instructions for specialized agent runs. */
		instructions?: string;
		options?: Partial<Omit<RunLanguageModelOptions, "system">>;
		/** Drain user messages queued for the next model step. */
		interjections?: () => zInterjectionPart[] | Promise<zInterjectionPart[]>;
		/** Output a tool reports while it is still running, keyed by call id */
		toolStream?: (_: {
			tool: Tool<any, any>;
			part: zToolCallPart;
			mutation: StreamMutation<
				z.infer<Exclude<ToolDefinition["stream"], void>>
			>;
		}) => void;
		/**
		 * Stops one tool call without stopping the generation. An interrupted
		 * call ends the loop so the model waits for the user rather than retrying.
		 */
		toolSignal?: (_: { part: zToolCallPart }) => AbortSignal | undefined;
	}) {
		const {
			config,
			enabledToolsets,
			enabledTools,
			messages,
			instructions: builtInstructions,
		} = await AgentService.build({ context, capabilities, toolsets, skills });
		const instructions = instructionOverride ?? builtInstructions;

		if (!config) throw new Error("missing config");
		const supportsTools = (
			await provider.getStatus({ user: context.user })
		).models
			.find((model) => model.name === config.model)
			?.features.includes("language:tools");

		const toolValidationErrors = new Map<string, unknown>();

		/** Raw input text of tool calls the model is still writing. */
		const toolInputs = new Map<string, { text: string; parsedAt: number }>();

		let parts = data[data.length - 1];

		const push = (part: zDataPart): zAgentEvent => {
			if (!parts) {
				console.warn(
					"[AgentService] parts array is undefined - this should not happen",
				);
				data.push([]);
				parts = data[data.length - 1];
			}
			parts.push(part);
			return { type: "data", value: part };
		};

		/** Runs one call to its result. Never rejects. */
		const run = async ({
			toolCall,
			tool,
			signal,
		}: {
			toolCall: zToolCallPart;
			tool: Tool<any, any>;
			signal?: AbortSignal;
		}): Promise<{ result: zToolResultPart; interrupted: boolean }> => {
			const signals = [
				options?.abortSignal,
				toolSignal?.({ part: toolCall }),
				signal,
			].filter((signal) => !!signal);
			const abort = signals.length ? AbortSignal.any(signals) : undefined;

			try {
				if (VERBOSE)
					console.log(
						`[AgentService] running tool ${toolCall.name} with args:`,
						toolCall.input,
					);
				const value = await ToolCallUtils.interruptible(
					tool.execute({
						input: toolCall.input,
						feedback: undefined,
						context,
						stream: toolStream
							? (mutation) => toolStream({ tool, part: toolCall, mutation })
							: undefined,
						abort,
					}),
					abort,
				);
				if (VERBOSE)
					console.log(
						`[AgentService] tool ${toolCall.name} finished with result:`,
						value,
					);
				return {
					interrupted: false,
					result: {
						type: "toolResult",
						id: toolCall.id,
						name: toolCall.name,
						output: value.map((part) => ({
							...part,
							id: CommonUtils.getRandomId(),
						})),
					},
				};
			} catch (error: any) {
				if (abort?.aborted) {
					console.log(`[AgentService] tool ${toolCall.name} interrupted`);
					return {
						interrupted: true,
						result: {
							type: "toolResult",
							id: toolCall.id,
							name: toolCall.name,
							error: true,
							output: ToolCallUtils.getInterruption(),
						},
					};
				}
				console.warn(
					`[AgentService] error running tool ${toolCall.name}:`,
					error,
				);
				return {
					interrupted: false,
					result: {
						type: "toolResult",
						id: toolCall.id,
						name: toolCall.name,
						error: true,
						output: [
							{
								type: "text",
								value: CommonUtils.formatError({ error, details: true }),
								id: CommonUtils.getRandomId(),
							},
						],
					},
				};
			}
		};

		/**
		 * Calls running in the background, by call id. Each settles once the part
		 * reporting it is in `finished`, which the model reads at its next step.
		 * They are stopped with the generation, and when it fails.
		 */
		const background = new Map<string, Promise<void>>();
		const finished: zInterjectionPart[] = [];
		const backgroundAbort = new AbortController();
		const runInBackground = (toolCall: zToolCallPart, tool: Tool<any, any>) => {
			background.set(
				toolCall.id,
				run({ toolCall, tool, signal: backgroundAbort.signal }).then(
					({ result }) => {
						background.delete(toolCall.id);
						finished.push({
							id: CommonUtils.getRandomId(),
							type: "interjection",
							value: result.output,
							task: {
								id: toolCall.id,
								name: toolCall.name,
								error: result.error,
							},
						});
					},
				),
			);
		};

		// A background call the user approved settles with its placeholder before
		// this generation resumes, and starts here.
		for (const part of data.flat()) {
			if (
				part.type !== "toolResult" ||
				!ToolCallUtils.isBackground(part.output) ||
				data
					.flat()
					.some((p) => p.type === "interjection" && p.task?.id === part.id)
			)
				continue;
			const toolCall = data
				.flat()
				.find(
					(p): p is zToolCallPart => p.type === "toolCall" && p.id === part.id,
				);
			const { tool } = toolCall
				? ToolUtils.find({ toolsets: enabledToolsets, part: toolCall })
				: { tool: null };
			if (toolCall && tool) runInBackground(toolCall, tool);
		}

		// Agentic loop: keep generating until the model stops calling tools
		while (true) {
			messages[messages.length - 1].data = data;

			parts = data[data.length - 1];

			/**
			 * Drop calls the model never finished writing. They carry no usable
			 * input and must not be persisted or sent back to the model.
			 */
			const settle = () => {
				toolInputs.clear();
				for (let i = (parts?.length ?? 0) - 1; i >= 0; i--) {
					const part = parts[i];
					if (part.type === "toolCall" && part.partial) parts.splice(i, 1);
				}
			};

			try {
				if (options?.abortSignal?.aborted) break;
				for (const part of [
					...finished.splice(0),
					...((await interjections?.()) ?? []),
				])
					yield push(part);
				const compacted = await AgentTokensService.compactMessages({
					instructions,
					messages,
					config,
					tools: supportsTools ? enabledTools : [],
				});
				const stream = ModelProviderService.runLanguageModel({
					user: context.user,
					provider,
					messages: compacted.messages,
					config,
					tools: enabledTools,
					env,
					options: {
						system: instructions,
						...options,
					},
				});

				for await (const event of stream) {
					if (event.type === "start") {
						console.log("[AgentService] starting step", {
							warnings: event.warnings,
						});
						data.push([]);
						parts = data[data.length - 1];
					}

					if (event.type === "toolInput") {
						if (event.name !== undefined) {
							toolInputs.set(event.id, { text: "", parsedAt: 0 });
							parts.push({
								type: "toolCall",
								id: event.id,
								name: event.name,
								input: {},
								partial: true,
							});
						} else if (event.delta) {
							const raw = toolInputs.get(event.id);
							const part = parts.find(
								(p): p is zToolCallPart =>
									p.type === "toolCall" && p.id === event.id && !!p.partial,
							);
							if (raw && part) {
								raw.text += event.delta;
								// Re-parsing the whole input on every token is quadratic in
								// its length, which a long file write makes noticeable.
								if (Date.now() - raw.parsedAt >= PARTIAL_INPUT_MS) {
									raw.parsedAt = Date.now();
									const { value } = await parsePartialJson(raw.text);
									// Replaced whole, so anything keyed on it sees the change.
									if (value && typeof value === "object") part.input = value;
								}
							}
						}
					}

					if (event.type === "data") {
						if (event.value.type === "text") {
							type Text = typeof event.value;
							const existing = parts.find(
								(p): p is Text =>
									p.type === "text" && p.id === (event.value as Text).id,
							);
							if (existing) {
								existing.value += event.value.value;
								if (event.value?.signature)
									existing.signature = event.value.signature;
							} else {
								parts.push(event.value);
							}
						} else if (event.value.type === "thought") {
							type Thought = typeof event.value;
							const existing = parts.find(
								(p): p is Thought =>
									p.type === "thought" && p.id === (event.value as Thought).id,
							);
							if (existing) {
								existing.value += event.value.value;
								if (event.value?.signature)
									existing.signature = event.value.signature;
							} else {
								parts.push(event.value);
							}
						} else if (event.value.type === "toolCall") {
							const { tool } = ToolUtils.find({
								toolsets: enabledToolsets,
								part: event.value,
							});
							if (tool?.validate) {
								try {
									event.value.validation = await tool.validate({
										input: event.value.input,
										context,
									});
								} catch (error) {
									console.warn(
										`[AgentService] tool ${event.value.name} failed validation:`,
										error,
									);
									toolValidationErrors.set(event.value.id, error);
								}
							}
							if (event.value.validation?.approval && !context.interactive) {
								toolValidationErrors.set(
									event.value.id,
									new Error(
										"This tool call cannot be completed as the user is not available to approve it.",
									),
								);
							}
							toolInputs.delete(event.value.id);
							const partial = parts.findIndex(
								(p) => p.type === "toolCall" && p.id === event.value.id,
							);
							if (partial === -1) parts.push(event.value);
							else parts[partial] = event.value;
						} else {
							parts.push(event.value);
						}
					}

					if (event.type === "end") {
						metadata.push(event.metadata);
					}

					yield event;
				}

				settle();

				if (options?.abortSignal?.aborted) {
					yield push({
						id: CommonUtils.getRandomId(),
						type: "abort",
						reason: "user",
						message: "Aborted",
						details: "",
					});
					break;
				}
			} catch (e: any) {
				console.error("[AgentService] error during stream:", e);
				settle();
				backgroundAbort.abort();
				yield push({
					id: CommonUtils.getRandomId(),
					type: "abort",
					reason: e.name === "AbortError" ? "user" : "error",
					message: e.message,
					details: JSON.stringify(e),
				});
				break;
			}

			const toolCalls = parts.filter((p) => p.type === "toolCall");
			if (VERBOSE)
				console.log(
					`[AgentService] ${toolCalls.length} tools called:`,
					toolCalls,
				);

			let stop = false;
			let interrupted = false;

			/** Calls to run, in the order the model made them. */
			const queue: { toolCall: zToolCallPart; tool: Tool<any, any> }[] = [];

			for (const toolCall of toolCalls) {
				const { tool } = ToolUtils.find({
					toolsets: enabledToolsets,
					part: toolCall,
				});

				if (!tool) {
					yield push({
						type: "toolResult",
						id: toolCall.id,
						name: toolCall.name,
						error: true,
						output: [
							{
								id: CommonUtils.getRandomId(),
								type: "text",
								value: `Tool "${toolCall.name}" not found`,
							},
						],
					});
					continue;
				}

				if (toolValidationErrors.has(toolCall.id)) {
					yield push({
						type: "toolResult",
						id: toolCall.id,
						name: toolCall.name,
						error: true,
						output: [
							{
								id: CommonUtils.getRandomId(),
								type: "text",
								value: CommonUtils.formatError({
									error: toolValidationErrors.get(toolCall.id),
									details: true,
								}),
							},
						],
					});
					continue;
				}

				if (tool.feedback || toolCall.validation?.approval) {
					stop = true;
					continue;
				}

				queue.push({ toolCall, tool });
			}

			// Calls run together, except that a sequential one runs alone. Results
			// land as calls finish, then are put back in the order of the calls.
			const running = new Map<
				string,
				{
					sequential: boolean;
					done: Promise<{ result: zToolResultPart; interrupted: boolean }>;
				}
			>();
			while (queue.length || running.size) {
				while (queue.length && !interrupted) {
					const [{ toolCall, tool }] = queue;
					const sequential = !!tool.sequential;
					const blocked = [...running.values()].some(
						(call) => call.sequential || sequential,
					);
					if (blocked) break;
					queue.shift();

					if (ToolCallUtils.isBackgrounded({ tool, part: toolCall })) {
						runInBackground(toolCall, tool);
						yield push({
							type: "toolResult",
							id: toolCall.id,
							name: toolCall.name,
							output: ToolCallUtils.getBackground({ id: toolCall.id }),
						});
						continue;
					}

					running.set(toolCall.id, {
						sequential,
						done: run({ toolCall, tool }),
					});
				}

				// Calls not yet started are not run: the user stepped in.
				if (interrupted) {
					for (const { toolCall } of queue.splice(0)) {
						yield push({
							type: "toolResult",
							id: toolCall.id,
							name: toolCall.name,
							error: true,
							output: ToolCallUtils.getInterruption(),
						});
					}
				}

				if (!running.size) continue;
				const settled = await Promise.race(
					[...running.values()].map(({ done }) => done),
				);
				running.delete(settled.result.id);
				if (settled.interrupted) interrupted = true;
				yield push(settled.result);
			}

			parts.splice(
				0,
				parts.length,
				...AgentUtils.getToolResultsSorted({ data: parts }),
			);

			if (options?.abortSignal?.aborted) {
				yield push({
					id: CommonUtils.getRandomId(),
					type: "abort",
					reason: "user",
					message: "Aborted",
				});
				break;
			}
			if (stop || interrupted) break;
			if (!toolCalls.length) {
				if (!background.size) {
					console.log("[AgentService] loop complete");
					break;
				}
				// The model is done for now, but a background call is not: wait for
				// one to report in, and let the model pick up from there.
				await Promise.race(background.values());
			}
		}

		// The generation does not end with calls still running in the background.
		await Promise.all(background.values());
		for (const part of finished.splice(0)) yield push(part);
	},
} as const;
