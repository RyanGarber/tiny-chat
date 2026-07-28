import { z } from "zod";
import type { Tool } from "../../types/tool.ts";

const input = z.object({
	question: z.string(),
	suggestions: z
		.array(z.string())
		.default([])
		.describe("A list of autocomplete suggestions."),
});

const feedback = z.object({
	answer: z.string(),
});

const output = feedback;

export const ask_question: Tool<
	typeof input,
	typeof feedback,
	typeof output,
	void
> = {
	name: "ask_question",
	description: "Ask the user a question mid-response.",
	input,
	feedback,
	output,

	execute: async ({ feedback }) => {
		return [{ type: "json", value: feedback }];
	},
};
