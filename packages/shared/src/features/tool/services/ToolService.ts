import type { Capabilities } from "../../capability/types/capability.ts";
import { createActionsToolset } from "../tools/actions.ts";
import { createFilesystemToolset } from "../tools/filesystem.ts";
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
		if (incognito) capabilities.userContext = undefined;

		return await Promise.all([
			await createActionsToolset({
				instructions:
					"Actions are recurring prompts, good for reminders and regular updates on topics. When a topic would benefit from such updates, ask the user if they'd like an action.",
				capabilities: {
					userContext: capabilities.userContext ?? (void 0 as never),
				},
				status: { valid: !!capabilities.userContext },
			}),

			await createMemoriesToolset({
				instructions:
					"You're in charge of storing memories. The system will curate and surface relevant facts for you, so do not hesitate to store any potentially useful fact you encounter.",
				capabilities: {
					userContext: capabilities.userContext ?? (void 0 as never),
				},
				status: { valid: !!capabilities.userContext },
			}),

			await createWebToolset({
				instructions:
					"You have full access to the web. While you should rely training knowledge for basic, historical, and static facts, always search when a topic could benefit from a more well-rounded or up-to-date answer.",
				capabilities: {
					webProvider: capabilities.webProvider ?? (void 0 as never),
				},
				status: { valid: !!capabilities.webProvider },
			}),

			await createFilesystemToolset({
				prefix: "chat",
				instructions:
					"You have access to a full virtual filesystem and shell scoped to this chat. Use this as a scratch pad, or to provide files to the user.",
				capabilities: {
					filesystem: capabilities.chatFilesystem ?? (void 0 as never),
				},
				status: { valid: !!capabilities.chatFilesystem },
			}),

			await createFilesystemToolset({
				prefix: "user",
				instructions:
					"You have access to the user's personal filesystem and shell. Use this whenever the user requests a task to be completed that requires it.",
				capabilities: {
					filesystem: capabilities.userFilesystem ?? (void 0 as never),
				},
				status: { valid: !!capabilities.userFilesystem },
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
