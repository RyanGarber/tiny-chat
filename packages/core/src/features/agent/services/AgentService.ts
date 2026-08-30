import type { z } from "zod";
import type { Capabilities } from "../../../core/types/capability.ts";
import type { zEnv } from "../../../core/types/env.ts";
import type { StreamMutation } from "../../../core/types/stream.ts";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { VERBOSE } from "../../../logger.ts";
import type {
	zConfig,
	zData,
	zDataPart,
	zMetadata,
} from "../../data/types/message.ts";
import {
	ModelProviderService,
	type RunLanguageModelOptions,
} from "../../provider/services/ModelProviderService.ts";
import type { ModelProvider } from "../../provider/types/model.ts";
import type { zSkill } from "../../skill/types/skill.ts";
import type { Tool, ToolDefinition, Toolset } from "../../tool/types/tool.ts";
import { ToolUtils } from "../../tool/utils/ToolUtils.ts";
import type { zAgentContext, zAgentEvent } from "../types/agent.ts";
import { AgentUtils } from "../utils/AgentUtils.ts";
import { AgentInstructionsService } from "./AgentInstructionsService.ts";
import { AgentMessagesService } from "./AgentMessagesService.ts";
import {
	AgentTokensService,
	type CompactionResult,
} from "./AgentTokensService.ts";

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
		const { prompt } = AgentUtils.getLastPrompt({messages: context.messages, withText: false});

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
			console.log("[AgentService] built agent:", messages, instructions);

		return {
			config: prompt?.config,
			enabledToolsets,
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
		skipInstructions,
	}: {
		context: zAgentContext;
		capabilities: Capabilities;
		config: zConfig;
		toolsets: Toolset<any>[];
		skills: zSkill[];
		skipInstructions?: boolean;
	}): Promise<CompactionResult> => {
		const { messages, instructions } = await AgentService.build({
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
		/** Output a tool reports while it is still running, keyed by call id */
		toolStream?: (_: {
			tool: Tool<any, any>;
			part: Extract<zDataPart, { type: "toolCall" }>;
			mutation: StreamMutation<
				z.infer<Exclude<ToolDefinition["stream"], void>>
			>;
		}) => void;
	}) {
		const {
			config,
			enabledToolsets,
			messages,
			instructions: builtInstructions,
		} = await AgentService.build({ context, capabilities, toolsets, skills });
		const instructions = instructionOverride ?? builtInstructions;

		if (!config) throw new Error("missing config");

		const toolValidationErrors = new Map<string, unknown>();

		// Agentic loop: keep generating until the model stops calling tools
		while (true) {
			messages[messages.length - 1].data = data;

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

			try {
				const compacted = await AgentTokensService.compactMessages({
					instructions,
					messages,
					config,
				});
				const stream = ModelProviderService.runLanguageModel({
					user: context.user,
					provider,
					messages: compacted.messages,
					config,
					tools: enabledToolsets.flatMap((toolset) =>
						toolset.tools
							.map((tool) => ({
								...tool,
								name: ToolUtils.name({ toolset, tool }),
							}))
							.filter((tool) => context.interactive || !tool.feedback),
					),
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
							parts.push(event.value);
						} else {
							parts.push(event.value);
						}
					}

					if (event.type === "end") {
						metadata.push(event.metadata);
					}

					yield event;
				}

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

				try {
					if (VERBOSE)
						console.log(
							`[AgentService] running tool ${toolCall.name} with args:`,
							toolCall.input,
						);
					const value = await tool.execute({
						input: toolCall.input,
						feedback: undefined,
						context,
						stream: toolStream
							? (mutation) => toolStream({ tool, part: toolCall, mutation })
							: undefined,
					});
					if (VERBOSE)
						console.log(
							`[AgentService] tool ${toolCall.name} finished with result:`,
							value,
						);
					yield push({
						type: "toolResult",
						id: toolCall.id,
						name: toolCall.name,
						output: value.map((part) => ({
							...part,
							id: CommonUtils.getRandomId(),
						})),
					});
				} catch (error: any) {
					console.warn(
						`[AgentService] error running tool ${toolCall.name}:`,
						error,
					);
					yield push({
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
					});
				}
			}

			if (stop || !toolCalls.length || options?.abortSignal?.aborted) {
				console.log("[AgentService] loop complete");
				break;
			}
		}
	},
} as const;
