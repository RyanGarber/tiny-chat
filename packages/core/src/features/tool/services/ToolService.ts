import type { Capabilities } from "../../capability/types/capability.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import { createActionsToolset } from "../tools/actions.ts";
import { createMemoriesToolset } from "../tools/memories.ts";
import { createQuestionsToolset } from "../tools/questions.ts";
import { createShellToolset } from "../tools/shell.ts";
import { createWebToolset } from "../tools/web.ts";
import type { Toolset } from "../types/tool.ts";

/**
 * How to work a codebase without drowning in it. Every search here is capped
 * and screened, so the productive move when a result set looks thin is a
 * narrower question rather than a bigger limit.
 */
const SHELL_INSTRUCTIONS = `Finding things: \`find_files\` for a glob when you want to see how the tree is laid out, \`search_files\` when you know what the code does but not what it says, and \`grep_files\` when you know the exact text or pattern. Searches skip dependency, build, generated, minified and git-ignored files, and report what they left out — when results are truncated, narrow the query or pass \`include\` instead of asking for more results.
Reading: \`read_file\` returns a window of lines. Page through a long file with \`offset\` and \`limit\`, and grep for what you need first rather than reading a large file end to end.
Editing: read the part of a file you are about to change, then use \`edit_file\` with enough surrounding context that \`old_string\` occurs exactly once. Its result shows the edited lines, so there is no need to re-read the file afterwards.
Prefer these tools over shell equivalents (\`ls\`, \`cat\`, \`find\`, \`grep\`, \`sed\`): they are bounded, and their output is shaped for you.`;

export const ToolService = {
	getTools: async ({
		capabilities,
		incognito,
	}: {
		capabilities: Capabilities;
		incognito: boolean;
	}): Promise<Toolset<any>[]> => {
		if (incognito) capabilities.user = undefined;

		return await Promise.all([
			await createActionsToolset({
				instructions:
					"Actions are recurring prompts, good for reminders and regular updates on topics. When a topic would benefit from such updates, ask the user if they'd like an action.",
				capabilities: {
					user: capabilities.user ?? (void 0 as never),
				},
				status: { valid: !!capabilities.user },
			}),

			await createMemoriesToolset({
				instructions:
					"You're in charge of storing memories. The system will curate and surface relevant facts for you, so do not hesitate to store any potentially useful fact you encounter.",
				capabilities: {
					user: capabilities.user ?? (void 0 as never),
				},
				status: { valid: !!capabilities.user },
			}),

			await createWebToolset({
				instructions:
					"You have full access to the web. While you should rely training knowledge for basic, historical, and static facts, always search when a topic could benefit from a more well-rounded or up-to-date answer.",
				capabilities: {
					provider: capabilities.web ?? (void 0 as never),
				},
				status: { valid: !!capabilities.web },
			}),

			await createShellToolset({
				prefix: "chat",
				instructions: `You have access to a virtual chat filesystem and shell. Use this as a scratchpad and Python environment. You must always use these \`chat_\`-prefixed tools for anything inside \`${PathUtils.mount}\` -  never when outside of it.
${SHELL_INSTRUCTIONS}`,
				capabilities: {
					shell: capabilities.chatShell ?? (void 0 as never),
				},
				status: { valid: !!capabilities.chatShell },
			}),

			await createShellToolset({
				instructions: `You have access to the user's own filesystem and shell. Use this to work with the user's actual files or device. You must always use these non-\`chat_\`-prefixed tools for anything outside of \`${PathUtils.mount}\` - never when inside it.
${SHELL_INSTRUCTIONS}`,
				capabilities: {
					shell: capabilities.shell ?? (void 0 as never),
				},
				status: { valid: !!capabilities.shell },
			}),

			await createQuestionsToolset({
				instructions:
					"You can ask the user questions mid-response, best used for getting more information or clarifying their intent before continuing.",
				capabilities: void 0,
				status: { valid: true },
			}),
		]);
	},
} as const;
