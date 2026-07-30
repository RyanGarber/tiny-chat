import type { Capabilities } from "../../capability/types/capability.ts";
import { createActionsToolset } from "../tools/actions.ts";
import { createShellToolset } from "../tools/filesystem.ts";
import { createMemoriesToolset } from "../tools/memories.ts";
import { createQuestionsToolset } from "../tools/questions.ts";
import { createWebToolset } from "../tools/web.ts";
import type { Toolset } from "../types/tool.ts";

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
				instructions:
					"You have access to a virtual chat filesystem and shell. Use this to read uploads, as a scratch pad, or to provide files to the user.",
				capabilities: {
					shell: capabilities.chatShell ?? (void 0 as never),
				},
				status: { valid: !!capabilities.chatShell },
			}),

			await createShellToolset({
				instructions:
					"You have access to the user's filesystem and shell. Use this whenever the user requests a task to be completed that requires it.",
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
