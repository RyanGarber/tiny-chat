import type { ToolsetFactory } from "../types/tool.ts";
import { ask_question } from "./questions/ask_question.ts";

export const createQuestionsToolset: ToolsetFactory<void> = (options) => {
	return {
		name: "questions",
		tools: [ask_question],
		...options,
	};
};
