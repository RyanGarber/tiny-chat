import { createAskQuestionTool } from "#core/features/tool/tools/questions/ask_question.ts";
import type {
	Toolset,
	ToolsetFactory,
} from "#core/features/tool/types/tool.ts";

export const createQuestionsToolset: ToolsetFactory<Toolset<void>> = async (
	options,
) => ({
	name: "questions",
	tools: [await createAskQuestionTool(options)],
	...options,
});
