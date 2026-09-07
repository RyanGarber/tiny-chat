import type { Capabilities } from "../../../core/types/capability.ts";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { SettingsUtils } from "../../../core/utils/SettingsUtils.ts";
import { VERBOSE } from "../../../logger.ts";
import type { zConfig } from "../../data/types/message.ts";
import { DataUtils } from "../../data/utils/DataUtils.ts";
import type { zSkill } from "../../skill/types/skill.ts";
import type { Toolset } from "../../tool/types/tool.ts";
import { ToolUtils } from "../../tool/utils/ToolUtils.ts";
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
		config?: zConfig | null;
		capabilities: Capabilities;
		enabledToolsets: Toolset<any>[];
		enabledSkills: zSkill[];
	}) => {
		const settings = SettingsUtils.of(context.user, context.chat?.folder);

		console.log(
			`[AgentInstructionsService] retrieving memories for prompt:`,
			AgentUtils.getLastPrompt({ messages: context.messages, withText: true }),
		);
		const memories = (
			await capabilities.memories?.retrieveMemories({
				chat: context.chat,
				tokens: settings.memoryBudget,
			})
		)?.sort((a, b) => a.id.localeCompare(b.id));
		if (VERBOSE)
			console.log(
				`[AgentInstructionsService] retrieved ${memories?.length ?? 0} memories`,
				memories?.map((memory) => memory.fact),
			);

		const actions = !context.chat?.incognito
			? await capabilities.actions?.getActions()
			: undefined;

		const cites = new Map<string, string>();
		if (enabledToolsets.some((toolset) => toolset.name === "actions")) {
			cites.set(
				"actions",
				`I'll <cite sources="xyzxyz">check for updates on the Mets game</cite> tomorrow.`,
			);
		}
		if (enabledToolsets.some((toolset) => toolset.name === "memories")) {
			cites.set(
				"memories",
				`Here's an example in <cite sources="123456 abcdef">Python, your favorite language</cite>.`,
			);
		}
		if (enabledToolsets.some((toolset) => toolset.name === "shell")) {
			cites.set(
				"files",
				`I'll now edit <cite sources="/home/user/desktop/todo.txt">your to-do list</cite> to mark off this task.`,
			);
		}
		if (enabledToolsets.some((toolset) => toolset.name === "web")) {
			cites.set(
				"web results",
				`As of yesterday, <cite sources="https://example.com/123456 https://msn.com/xyz">the DOW has fallen 5 points</cite>.`,
			);
		}
		const citeTypes = Array.from(cites.keys());
		const citeTypeList = citeTypes.length
			? citeTypes.slice(0, -1).join(", ") +
				(citeTypes.length > 1 ? ", or " : "") +
				citeTypes.at(-1)
			: undefined;
		const citeExamples = Array.from(cites.values());

		let instructions = `Formatting re-enabled.`;

		if (config?.model) {
			instructions += `\n
## Identity\n
Only the text inside <message role="assistant" model="${config?.model}"> was written by you. Other assistant messages were written by different models that may have different knowledge and capabilities.
When referencing past assistant messages, always use the model name - do not say "I" if it wasn't you (${config?.model}). Critique other assistants' messages from your own perspective when appropriate.`;
		}

		instructions += `\n
## Instructions\n
The times mentioned in <message> blocks are the user's local time. Never convert to UTC when calling tools, always use the user's time.
Always take those times into account. Do not assume the chat is continuous. Consider whether the user's intent has changed between messages.`;

		instructions += `\n
Markdown, Mermaid, and LaTeX are supported. Use headers, tables, lists, math, code blocks, diagrams, and images when they would genuinely help illustrate your point.
Important: Always use two dollar signs ($$...$$) for both inline and display math - never one ($...$). Use one dollar sign in non-math cases such as currency ($5.00).`;

		if (citeTypeList) {
			instructions += `\n
When a statement is based on or references ${citeTypeList}, always wrap it in a <cite> tag with their IDs or URLs separated by spaces. For example:
${citeExamples.map((r) => `- ${r}`).join("\n")}`;
		}

		const cwd =
			enabledToolsets.some((toolset) => toolset.name === "shell") &&
			!!capabilities.shell?.cwd;

		if (
			actions?.length ||
			memories?.length ||
			enabledToolsets.length ||
			enabledSkills.length ||
			cwd
		) {
			instructions += `\n
## Context`;

			if (actions?.length) {
				instructions += `\n
<actions>
${actions?.map((action) => `<action id="${action.id}" schedule="${action.schedule}">\n${DataUtils.getText(action)}\n</action>`).join("\n")}
</actions>`;
			}

			if (memories?.length) {
				instructions += `\n
<memories>
${memories.map((memory) => `<memory id="${memory.id}" category="${memory.category}" stability="${memory.stability}" learned="${CommonUtils.formatDate({ date: memory.createdAt, timezone: context.timezone })}">\n${memory.fact}\n</memory>`).join("\n")}
</memories>`;
			}

			if (enabledToolsets.length) {
				instructions += `\n
<toolsets>
${enabledToolsets.map((toolset) => `<toolset name="${ToolUtils.name({ toolset })}">\n${toolset.instructions}\n</toolset>`).join("\n")}
</toolsets>`;
			}

			if (enabledSkills.length) {
				instructions += `\n
<skills>
${enabledSkills.map((skill) => `<skill name="${skill.name}" path="${skill.path}">\n${skill.description}\n</skill>`).join("\n")}
</skills>`;

				if (enabledToolsets.some((toolset) => toolset.name === "shell")) {
					instructions += `\n
As an assistant, you may have access to additional skills. When one seems relevant, use your tools to read its \`SKILL.md\` file and follow instructions from there.`;
				}
			}
		}

		if (settings.instructions?.length) {
			instructions += `\n
## Additional Instructions\n
${settings.instructions.join("\n")}`;
		}

		return instructions;
	},
} as const;
