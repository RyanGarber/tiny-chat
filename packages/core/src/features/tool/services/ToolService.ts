import type { Capabilities } from "../../../core/types/capability.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import { createActionsToolset } from "../tools/actions.ts";
import { createMemoriesToolset } from "../tools/memories.ts";
import { createQuestionsToolset } from "../tools/questions.ts";
import { edit_file } from "../tools/shell/edit_file.ts";
import { find_files } from "../tools/shell/find_files.ts";
import { grep_files } from "../tools/shell/grep_files.ts";
import { read_dir } from "../tools/shell/read_dir.ts";
import { read_file } from "../tools/shell/read_file.ts";
import { search_files } from "../tools/shell/search_files.ts";
import { shell_exec } from "../tools/shell/shell_exec.ts";
import { createShellToolset } from "../tools/shell.ts";
import { createSubagentsToolset } from "../tools/subagents.ts";
import { createWebToolset } from "../tools/web.ts";
import type { Toolset } from "../types/tool.ts";

export const ToolService = {
	getTools: async ({
		capabilities,
	}: {
		capabilities: Capabilities;
	}): Promise<Toolset<any>[]> => {
		return await Promise.all([
			await createActionsToolset({
				instructions:
					"Actions are recurring prompts, good for reminders and regular updates on topics. When a topic would benefit from such updates, ask the user if they'd like an action.",
				capabilities: {
					actions: capabilities.actions ?? (void 0 as never),
				},
				status: { valid: !!capabilities.actions },
			}),

			await createMemoriesToolset({
				instructions:
					"Use these tools to manage memories about the user or to search prior memories/chats when it would improve a response.",
				capabilities: {
					memories: capabilities.memories ?? (void 0 as never),
					embedding: capabilities.embedding ?? (void 0 as never),
				},
				status: { valid: !!capabilities.memories },
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
				instructions: `You have access to filesystem and shell tools in the following contexts:
${capabilities.shell ? `- Anything OUTSIDE of \`${PathUtils.mount}\`: the user's local shell. Use this any time you need to work with the user's local files or system.` : ""}
${capabilities.chatShell ? `- Anything INSIDE of \`${PathUtils.mount}\`: the virtual chat shell. Use this any time you need a scratch pad or to access the user's uploads.` : ""}

The virtual chat (\`${PathUtils.mount}\`) filesystem holds three trees:
- \`${PathUtils.mount}/uploads/<id>\` — files the user uploaded or cloned. Read only.
- \`${PathUtils.mount}/skills/<id>\` — the skills this message is configured with. Read only.
- \`${PathUtils.mount}/chat/<id>\` — this chat's own working directory, and the only place you can write.
To change a file from an upload or a skill, \`cp\` it into the chat's directory first and work on the copy; the original stays as it is for every other chat that uses it.

Finding things: \`${find_files.name}\` for a glob when you want to see how the tree is laid out, \`${search_files.name}\` when you know what the code does but not what it says, and \`${grep_files.name}\` when you know the exact text or pattern. Searches skip dependency, build, generated, minified and git-ignored files, and report what they left out — when results are truncated, narrow the query or pass \`include\` instead of asking for more results.
Reading: \`${read_file.name}\` returns a window of lines. Page through a long file with \`offset\` and \`limit\`, and grep for what you need first rather than reading a large file end to end.
Editing: read the part of a file you are about to change, then use \`${edit_file.name}\` with enough surrounding context that \`old_string\` occurs exactly once. Its result shows the edited lines, so there is no need to re-read the file afterwards.

Always use ${read_dir.name}, ${read_file.name}, ${find_files.name}, ${search_files.name} and ${grep_files.name} over \`ls\`, \`cat\`, \`find\`, and \`grep\`.
${search_files.name} and ${grep_files.name} read text, so they pass over images, archives, databases and build output. When you need to know what files exist rather than what they say — and whenever an attachment is a directory the user sent you — use ${find_files.name} or ${read_dir.name}, which hide nothing of the sort.
When working in a codebase, look before you act: find the relevant files, read the parts you are about to change, then make the smallest edit that does the job. Say what you changed and how you verified it. When a search or a file comes back truncated, ask a narrower question rather than pulling in more of it — context you spend on noise is context you no longer have for the task.

For all file-related tools, the filesystem will be detected automatically from the path provided.
For \`${shell_exec.name}\` specifically, you MUST specify \`mnt: true\` to run in the virtual \`${PathUtils.mount}\` filesystem, or \`mnt: false\` to run in the user's local filesystem.

Current working directories (each shell resolves relative command paths from its own directory):
- User shell (\`shell_exec\` with \`mnt: false\`, user's machine): ${(await capabilities.shell?.cwd?.()) ?? "unavailable"}
- Chat shell (\`shell_exec\` with \`mnt: true\`, virtual \`/mnt\` filesystem): ${(await capabilities.chatShell?.cwd?.()) ?? "unavailable"}
These are separate filesystems. Changing directory in one does not change the other. Use absolute paths for file tools.`,
				capabilities: {
					shell: capabilities.shell ?? (void 0 as never),
					chatShell: capabilities.chatShell ?? (void 0 as never),
				},
				status: { valid: !!capabilities.shell || !!capabilities.chatShell },
			}),

			await createQuestionsToolset({
				instructions:
					"You can ask the user questions mid-response, best used for getting more information or clarifying their intent before continuing.",
				capabilities: void 0,
				status: { valid: true },
			}),

			await createSubagentsToolset({
				instructions:
					"You can spawn subagents to do work for you and come back with a result. Use this for tasks that require a lot of context, such as exploring a codebase, to keep your context clean so you can focus on reasoning.",
				capabilities: {
					subagents: capabilities.subagents ?? (void 0 as never),
				},
				status: { valid: !!capabilities.subagents },
			}),
		]);
	},
} as const;
