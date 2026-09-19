import { z } from "zod";
import type { SubagentsCapability } from "../../../../core/types/capability.ts";
import { CommonUtils } from "../../../../core/utils/CommonUtils.ts";
import { SettingsUtils } from "../../../../core/utils/SettingsUtils.ts";
import { zAbortPart, zData } from "../../../data/types/part.ts";
import { DataUtils } from "../../../data/utils/DataUtils.ts";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const spawn_subagent = {
	name: "spawn_subagent",
	description: "Run a subagent to perform a task.",
	input: z.object({
		task: z
			.string()
			.describe(
				"A 1-2 sentence describing what the agent will do to the user.",
			),
		prompt: z
			.string()
			.describe(
				"Detailed instructions for the agent, including the task to perform and the results to provide.",
			),
	}),
	output: z.object({
		response: z.string(),
		errors: z.array(
			zAbortPart.transform((part) => ({
				reason: part.reason,
				message: part.message,
				details: part.details,
			})),
		),
	}),
	stream: zData,
} as const satisfies ToolDefinition;

export const createSpawnSubagentTool: ToolFactory<
	Tool<typeof spawn_subagent, { subagents: SubagentsCapability }>
> = (options) => ({
	...spawn_subagent,
	...options,
	execute: async ({ input, stream, abort, context }) => {
		const { subagentConfig } = SettingsUtils.of(
			context.user,
			context.chat?.folder,
		);
		if (!subagentConfig) throw new Error("missing subagent config");

		const data = await options.capabilities.subagents.runSubagent({
			context: {
				user: context.user,
				chat: context.chat,
				messages: [
					{
						id: null,
						author: "USER",
						config: subagentConfig,
						data: [
							[
								{
									id: CommonUtils.getRandomId(),
									type: "text",
									value: input.prompt,
								},
							],
						],
						createdAt: Temporal.Now.plainDateTimeISO("UTC"),
					},
					{
						id: null,
						author: "MODEL",
						config: subagentConfig,
						data: [],
						createdAt: Temporal.Now.plainDateTimeISO("UTC"),
					},
				],
				timezone: context.timezone,
				interactive: false,
			},
			instructions:
				"You are an autonomous subagent running in a non-interactive context. Read-only tools and bash commands will work, but those that require approval (such as sed) will not. Use the tools available to you to complete your task to the best of your abilities.",
			onData: (data) => stream?.({ mode: "replace", data }),
			abort,
		});
		console.log("[spawn_subagent] response from agent:", data);
		const error = data.flat().find((part) => part.type === "abort");
		if (error?.reason === "error") {
			console.error("Subagent error:", error);
			throw new Error(
				`Failed to run subagent due to ${error.reason}: ${CommonUtils.formatError(error)}`,
			);
		}
		return [
			{
				type: "json",
				value: {
					response: DataUtils.getText({ data }),
					errors: error
						? [
								{
									reason: error.reason,
									message: error.message,
									details: error.details,
								},
							]
						: [],
				},
			},
		];
	},
});
