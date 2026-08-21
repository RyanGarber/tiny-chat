import { z } from "zod";
import type { SubagentsCapability } from "../../../../core/types/capability.ts";
import {
	Author,
	zConfig,
	zData,
	zDataPart,
} from "../../../data/types/message.ts";
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
	feedback: zConfig,
	output: z.object({
		response: z.string(),
		errors: z.array(
			zDataPart
				.refine((part) => part.type === "abort")
				.transform((part) => ({
					reason: part.reason,
					message: part.message,
					details: part.details,
				})),
		),
	}),
	stream: zData,
} as const satisfies ToolDefinition;

export const createSpawnSubagentTool: ToolFactory<
	Tool<typeof spawn_subagent, { subagent: SubagentsCapability }>
> = (options) => ({
	...spawn_subagent,
	...options,
	execute: async ({ input, feedback, stream, abort, context }) => {
		const data = await options.capabilities.subagent.runSubagent({
			context: {
				user: context.user,
				chat: context.chat,
				messages: [
					{
						id: null,
						author: Author.USER,
						config: feedback,
						data: [[{ type: "text", value: input.prompt }]],
						createdAt: new Date(),
					},
					{
						id: null,
						author: Author.MODEL,
						config: feedback,
						data: [],
						createdAt: new Date(),
					},
				],
				timezone: context.timezone,
				interactive: false,
			},
			config: feedback,
			onData: (data) => stream?.({ mode: "replace", data }),
			abort,
		});
		console.log("[spawn_subagent] response from agent:", data);
		const error = data.flat().find((part) => part.type === "abort");
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
