import { z } from "zod";
import type { Tool, ToolDefinition, ToolFactory } from "../../types/tool.ts";

export const ask_question = {
	name: "ask_question",
	description: "Ask the user a question mid-response.",
	input: z.object({
		question: z.string(),
		suggestions: z
			.array(z.string())
			.default([])
			.describe("A list of autocomplete suggestions."),
	}),
	feedback: z.object({
		answer: z.string(),
	}),
	output: z.object({
		answer: z.string(),
	}),
} as const satisfies ToolDefinition;

export const createAskQuestionTool: ToolFactory<
	Tool<typeof ask_question, void>
> = (options) => ({
	...ask_question,
	...options,
	execute: async ({ feedback }) => {
		return [{ type: "json", value: feedback }];
	},
});
