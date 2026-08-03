import type { zEnv } from "../../../core/types/env.ts";
import type { Capabilities } from "../../capability/types/capability.ts";
import type { zData, zDataPart, zMetadata } from "../../data/types/message.ts";
import {
	ModelProviderService,
	type RunLanguageModelOptions,
} from "../../provider/services/ModelProviderService.ts";
import type { ModelProvider } from "../../provider/types/model.ts";
import type { zSkill } from "../../skill/types/skill.ts";
import type { Toolset } from "../../tool/types/tool.ts";
import { ToolUtils } from "../../tool/utils/ToolUtils.ts";
import type { zAgentContext, zAgentEvent } from "../types/agent.ts";
import { AgentUtils } from "../utils/AgentUtils.ts";
import { AgentInstructionsService } from "./AgentInstructionsService.ts";
import { AgentMessagesService } from "./AgentMessagesService.ts";

export const AgentService = {
	generate: async function* ({
		provider,
		context,
		capabilities,
		toolsets,
		skills,
		data,
		metadata,
		env,
		options,
	}: {
		provider: ModelProvider<any>;
		context: zAgentContext;
		capabilities: Capabilities;
		toolsets: Toolset<any>[];
		skills: zSkill[];
		data: zData;
		metadata: zMetadata;
		env: Partial<zEnv>;
		options: Partial<Omit<RunLanguageModelOptions, "system">>;
	}) {
		const config = AgentUtils.getLastPrompt(context).prompt.config;
		if (!config) throw new Error("no prompt or config found");

		const enabledToolsets = toolsets.filter((toolset) =>
			config.toolsets?.includes(ToolUtils.name({ toolset })),
		);
		console.log("[AgentService] enabled tools:", enabledToolsets);
		const enabledSkills = skills.filter((skill) =>
			config.skills?.includes(skill.path),
		);
		console.log("[AgentService] enabled skills:", enabledSkills);

		const { messages, customInstructions } =
			await AgentMessagesService.buildMessages({
				context,
				capabilities,
			});

		const instructions =
			customInstructions ??
			(await AgentInstructionsService.buildInstructions({
				context,
				config,
				capabilities,
				enabledToolsets,
				enabledSkills,
			}));

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
				const stream = ModelProviderService.runLanguageModel({
					user: context.user,
					provider,
					messages,
					config,
					tools: enabledToolsets.flatMap((toolset) =>
						toolset.tools.map((tool) => ({
							...tool,
							name: ToolUtils.name({ toolset, tool }),
						})),
					),
					env,
					options: {
						...options,
						system: instructions,
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
					type: "abort",
					reason: e.name === "AbortError" ? "user" : "error",
					message: e.message,
					details: JSON.stringify(e),
				});
				break;
			}

			const toolCalls = parts.filter((p) => p.type === "toolCall");
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
						value: [
							{ type: "text", value: `Tool "${toolCall.name}" not found` },
						],
					});
					continue;
				}

				if (tool.feedback || tool.approval) {
					stop = true;
					continue;
				}

				try {
					console.log(
						`[AgentService] running tool ${toolCall.name} with args:`,
						toolCall.args,
					);
					const value = await tool.execute({
						input: toolCall.args,
						feedback: undefined,
						context,
					});
					console.log(
						`[AgentService] tool ${toolCall.name} finished with result:`,
						value,
					);
					yield push({
						type: "toolResult",
						id: toolCall.id,
						name: toolCall.name,
						value,
					});
				} catch (e: any) {
					console.warn(
						`[AgentService] error running tool ${toolCall.name}:`,
						e,
					);
					yield push({
						type: "toolResult",
						id: toolCall.id,
						name: toolCall.name,
						error: true,
						value: [
							{
								type: "text",
								value: e instanceof Error ? e.message : JSON.stringify(e),
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
