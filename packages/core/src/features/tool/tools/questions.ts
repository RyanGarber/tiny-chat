import type { Toolset, ToolsetFactory } from "../types/tool.ts";
import { createAskQuestionTool } from "./questions/ask_question.ts";

export const createQuestionsToolset: ToolsetFactory<Toolset<void>> = async (
	options,
) => ({
	name: "questions",
	tools: [await createAskQuestionTool(options)],
	...options,
});
