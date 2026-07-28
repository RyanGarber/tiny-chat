import { format } from "timeago.js";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import type { Capabilities } from "../../capability/types/capability.ts";
import { type zConfig, zData } from "../../data/types/message.ts";
import { DataUtils } from "../../data/utils/DataUtils.ts";
import type { zSkill } from "../../skill/types/skill.ts";
import type { zToolset } from "../../tool/types/tool.ts";
import type { zAgentContext } from "../types/agent.ts";
import { AgentUtils } from "../utils/AgentUtils.ts";

export const AgentInstructionsService = {
	buildInstructions: async ({
		context,
		config,
		enabledToolsets,
		enabledSkills,
		capabilities,
	}: {
		context: zAgentContext;
		config: zConfig;
		capabilities: Capabilities;
		enabledToolsets: zToolset[];
		enabledSkills: zSkill[];
	}) => {
		const { prompt } = AgentUtils.getLastPrompt(context);
		const promptText = DataUtils.getTextCleaned(prompt);
		const promptEmbedding = prompt.id
			? await capabilities.embedding?.getEmbedding({
					message: { id: prompt.id },
				})
			: await capabilities.embedding?.embed({ text: promptText });

		console.log(
			`[InstructionsService] prompt [${prompt.id}]: '${promptText.slice(0, 100)}...' (embedding: ${!!promptEmbedding?.length})`,
		);

		// TODO WIP - remove capability when incognito or keep direct incognito check?
		const memories = !context.chat?.incognito
			? await capabilities.userContext?.searchMemories({
					searchText: promptText,
					searchEmbedding: promptEmbedding,
				})
			: undefined;

		const actions = !context.chat?.incognito
			? await capabilities.userContext?.getActions()
			: undefined;

		const userInstructions = !context.chat?.incognito
			? context.user.settings.instructions
			: [];

		const cites: Record<string, string> = {};
		if (enabledToolsets.some((toolset) => toolset.name === "actions"))
			cites.actions = `I'll <cite sources="xyzxyz">check for updates on the Mets game</cite> tomorrow.`;
		if (enabledToolsets.some((toolset) => toolset.name === "memories"))
			cites.memories = `Here's an example in <cite sources="123456 abcdef">Python, your favorite language</cite>.`;
		if (enabledToolsets.some((toolset) => toolset.name === "web"))
			cites["web results"] =
				`As of yesterday, <cite sources="https://example.com/123456 https://msn.com/xyz">the DOW has fallen 5 points</cite>.`;
		const citeTypes =
			Object.keys(cites).slice(0, -1).join(", ") +
			(Object.keys(cites).length > 1 ? " or " : "") +
			Object.keys(cites)[Object.keys(cites).length - 1];
		const citeExamples = Object.values(cites);

		return `Formatting re-enabled.

## Identity

Only the text inside <message role="assistant" model="${config.model}"> was written by you. Other assistant messages were written by different models that may have different knowledge and capabilities.
When referencing past assistant messages, always use the model name - do not say "I" if it wasn't you (${config.model}). Critique other assistants' messages from your own perspective when appropriate.

${userInstructions?.length ? `\n${userInstructions.join("\n")}` : ""}

## Instructions

It is currently ${CommonUtils.getDateFormatted(context)}. Always consider ${CommonUtils.getDateFormatted(context)} the date and time. Never convert to UTC when calling tools.
${context.messages.some((m) => m.createdAt) ? "Always take conversation timing into account. Do not assume the chat is continuous. Consider whether the user's intent has changed between messages." : ""}

Markdown, Mermaid, and LaTeX are supported. Use headers, tables, lists, math, code blocks, diagrams, and images when they would genuinely help illustrate your point.
Important: Always use two dollar signs ($$...$$) for both inline and display math - never one ($...$). Use one dollar sign in non-math cases such as currency ($5.00).

${
	citeTypes
		? `When a statement is based on or references ${citeTypes}, always wrap it in a <cite> tag with their IDs or URLs separated by spaces. For example:
${citeExamples.map((r) => `- ${r}`).join("\n")}`
		: ""
}

## Context

As an assistant, you may have access to additional skills. When one seems relevant, use your tools to read its \`SKILL.md\` file and follow instructions from there.

${
	actions
		? `<actions>
${actions?.map((action) => `<action id="${action.id}" schedule="${action.schedule}">\n${DataUtils.getText({ data: zData.parse(action) })}\n</action>`).join("\n")}
</actions>`
		: ""
}
${
	memories
		? `<memories>
${memories.map((memory) => `<memory id="${memory.id}" category="${memory.category}" stability="${memory.stability}" learned="${format(memory.createdAt)}">\n${memory.fact}\n</memory>`).join("\n")}
</memories>`
		: ""
}
<skills>
${enabledSkills.map((skill) => `<skill name="${skill.name}" path="${skill.path}">\n${skill.description}\n</skill>`).join("\n")}
</skills>
<toolsets>
${enabledToolsets.map((toolset) => `<toolset name="${toolset.name}">\n${toolset.instructions ?? "No instructions available."}\n</toolset>`).join("\n")}
</toolsets>
`;
	},
} as const;
