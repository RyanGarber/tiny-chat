import { z } from "zod";
import type { ToolDisplay } from "#core/features/tool/types/display.ts";
import type {
	Tool,
	ToolDefinition,
	ToolFactory,
} from "#core/features/tool/types/tool.ts";

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

const display: ToolDisplay<typeof ask_question> = {
	status: ({ input }) => [
		["Asking", "Asked"],
		{ count: ["question", "questions"], subject: input.question ?? "" },
	],
	input: ({ input }) => [{ type: "markdown", value: input.question ?? "" }],
	fields: ({ input }) => [
		{
			type: "choice",
			name: "answer",
			options: (input.suggestions ?? []).filter(
				(suggestion): suggestion is string => !!suggestion,
			),
			custom: true,
			placeholder: "Something else…",
		},
	],
	output: ({ output }) =>
		output.map(({ answer }) => ({
			type: "markdown",
			value: answer,
			quote: true,
		})),
};

export const createAskQuestionTool: ToolFactory<
	Tool<typeof ask_question, void>
> = (options) => ({
	...ask_question,
	...options,
	display,
	execute: async ({ feedback }) => {
		return [{ type: "json", value: feedback }];
	},
});
