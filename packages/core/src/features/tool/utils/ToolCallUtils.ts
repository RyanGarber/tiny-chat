import { z } from "zod";
import type { CodeLanguage } from "../../../core/utils/CodeUtils.ts";
import type { zDataBasicPart, zDataPart } from "../../data/types/message.ts";
import type { RenderedPart } from "../../data/utils/DataUtils.ts";
import { FileTypeUtils } from "../../file/utils/FileTypeUtils.ts";
import { FileUtils } from "../../file/utils/FileUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import { create_action } from "../tools/actions/create_action.ts";
import { delete_action } from "../tools/actions/delete_action.ts";
import { list_actions } from "../tools/actions/list_actions.ts";
import { update_action } from "../tools/actions/update_action.ts";
import { create_memory } from "../tools/memories/create_memory.ts";
import { delete_memory } from "../tools/memories/delete_memory.ts";
import { search_chats } from "../tools/memories/search_chats.ts";
import { search_memories } from "../tools/memories/search_memories.ts";
import { update_memory } from "../tools/memories/update_memory.ts";
import { ask_question } from "../tools/questions/ask_question.ts";
import { edit_file } from "../tools/shell/edit_file.ts";
import { find_files } from "../tools/shell/find_files.ts";
import { grep_files } from "../tools/shell/grep_files.ts";
import { read_dir } from "../tools/shell/read_dir.ts";
import { read_file } from "../tools/shell/read_file.ts";
import { search_files } from "../tools/shell/search_files.ts";
import { shell_exec } from "../tools/shell/shell_exec.ts";
import { write_file } from "../tools/shell/write_file.ts";
import { search_web } from "../tools/web/search_web.ts";
import { view_web } from "../tools/web/view_web.ts";
import type { ToolDefinition, Toolset } from "../types/tool.ts";
import { ToolUtils } from "./ToolUtils.ts";

const UNKNOWN = {
	name: "unknown" as const,
	description: "unknown",
	input: z.unknown(),
	output: z.unknown(),
} satisfies ToolDefinition;

export type ToolCallDisplay<
	T extends ToolDefinition,
	U extends boolean = false,
> = {
	name: T["name"];
	status: (string | { subject: string })[];
	approval?: "pending" | "approved" | "rejected";
	feedback?: "pending" | "complete";
	result: "pending" | "success" | "error";
	input: z.infer<T["input"]>;
	output?: U extends true ? z.infer<T["output"]>[] : z.infer<T["output"]>;
	append?: zDataBasicPart[];
};

export type ToolCallDisplayType =
	| ToolCallDisplay<typeof search_web, true>
	| ToolCallDisplay<typeof view_web>
	| ToolCallDisplay<typeof create_action>
	| ToolCallDisplay<typeof update_action>
	| ToolCallDisplay<typeof delete_action>
	| ToolCallDisplay<typeof list_actions, true>
	| ToolCallDisplay<typeof create_memory>
	| ToolCallDisplay<typeof update_memory>
	| ToolCallDisplay<typeof delete_memory>
	| ToolCallDisplay<typeof search_memories, true>
	| ToolCallDisplay<typeof search_chats, true>
	| ToolCallDisplay<typeof search_files, true>
	| ToolCallDisplay<typeof grep_files, true>
	| ToolCallDisplay<typeof find_files, true>
	| ToolCallDisplay<typeof read_dir, true>
	| (ToolCallDisplay<typeof read_file> & {
			language?: CodeLanguage;
			content?: { type: "image" | "text"; value: string };
	  })
	| (ToolCallDisplay<typeof write_file> & { language?: CodeLanguage })
	| (ToolCallDisplay<typeof edit_file> & { language?: CodeLanguage })
	| (ToolCallDisplay<typeof shell_exec> & { content?: string })
	| ToolCallDisplay<typeof ask_question>
	| ToolCallDisplay<typeof UNKNOWN>;

export const ToolCallUtils = {
	rejection: [
		{ type: "json", value: "Tool call rejected by user" },
	] satisfies zDataBasicPart[],

	getDisplay: ({
		part,
		toolsets,
	}: {
		part: Extract<RenderedPart, { type: "toolCall" }>;
		toolsets: Toolset<any>[];
	}): ToolCallDisplayType => {
		const { tool } = ToolUtils.find({ toolsets, part });

		const base = <T extends ToolDefinition, U extends boolean = false>(
			definition: T,
			status: (ToolCallDisplayType["status"][number] | [string, string])[],
			multiple?: U,
		) =>
			({
				name: definition.name as T["name"],
				status: status.map((piece) =>
					Array.isArray(piece) ? piece[part.result ? 1 : 0] : piece,
				),
				result:
					part.result === undefined
						? "pending"
						: part.result?.error
							? "error"
							: "success",
				approval: tool?.approval
					? part.result === undefined
						? "pending"
						: ToolCallUtils.isRejected(part.result)
							? "rejected"
							: "approved"
					: undefined,
				feedback: tool?.feedback
					? part.result === undefined
						? "pending"
						: "complete"
					: undefined,
				input: part.args as z.infer<T["input"]>,
				output: (multiple
					? ToolUtils.json<T>(part.result, true)
					: ToolUtils.json<T>(part.result)[0]) as U extends true
					? z.infer<T["output"]>[]
					: z.infer<T["output"]>,
				append: part.result?.append,
			}) satisfies ToolCallDisplay<any>;

		if (ToolUtils.is(toolsets, part, search_web)) {
			return {
				...base(
					search_web,
					[
						["Searching web for", "Searched web for"],
						{ subject: part.args.query },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, view_web)) {
			return {
				...base(view_web, [
					["Viewing link", "Viewed link"],
					{ subject: part.args.url },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, create_action)) {
			return {
				...base(create_action, [
					["Scheduling action", "Scheduled action"],
					{ subject: part.args.prompt },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, update_action)) {
			return {
				...base(update_action, [
					["Updating action", "Updated action"],
					{ subject: part.args.prompt },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, delete_action)) {
			return {
				...base(delete_action, [
					["Deleting action", "Deleted action"],
					{ subject: part.args.reason },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, list_actions)) {
			return {
				...base(list_actions, [["Listing", "Listed"], "actions"], true),
			};
		} else if (ToolUtils.is(toolsets, part, create_memory)) {
			return {
				...base(create_memory, [
					["Remembering", "Remembered"],
					{ subject: part.args.fact },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, update_memory)) {
			return {
				...base(update_memory, [
					["Updating memory", "Updated memory"],
					{ subject: part.args.fact },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, delete_memory)) {
			return {
				...base(delete_memory, [
					["Deleting memory", "Deleted memory"],
					{ subject: part.args.reason },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, search_memories)) {
			return {
				...base(
					search_memories,
					[
						["Searching memory for", "Searched memory for"],
						{ subject: part.args.query },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, search_chats)) {
			return {
				...base(
					search_chats,
					[
						["Searching chats for", "Searched chats for"],
						{ subject: part.args.query },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, read_dir)) {
			return {
				...base(
					read_dir,
					[
						["Browsing folder", "Browsed folder"],
						{ subject: PathUtils.name(part.args.path) },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, find_files)) {
			return {
				...base(
					find_files,
					[
						["Finding files matching", "Found files matching"],
						{ subject: part.args.pattern },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, search_files)) {
			return {
				...base(
					search_files,
					[
						["Searching files for", "Searched files for"],
						{ subject: part.args.query },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, grep_files)) {
			return {
				...base(
					grep_files,
					[
						["Grepping files for", "Grepped files for"],
						{ subject: part.args.query },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, read_file)) {
			const file = ToolUtils.file(part.result)[0];
			const image = file?.mime.startsWith("image/")
				? `data:${file.mime};base64,${file.data}`
				: null;
			const text = file && !image ? FileUtils.getTextFromBytes(file) : null;
			return {
				...base(read_file, [
					["Reading file", "Read file"],
					{ subject: PathUtils.name(part.args) },
				]),
				content: image
					? { type: "image", value: image }
					: text
						? {
								type: "text",
								value: text,
							}
						: undefined,
				language: FileTypeUtils.getLanguage({
					mime: file?.mime,
					name: file?.name,
				}),
			};
		} else if (ToolUtils.is(toolsets, part, write_file)) {
			return {
				...base(write_file, [
					["Writing file", "Wrote file"],
					{ subject: PathUtils.name(part.args) },
				]),
				language: FileTypeUtils.getLanguage({
					path: part.args.path,
				}),
			};
		} else if (ToolUtils.is(toolsets, part, edit_file)) {
			return {
				...base(edit_file, [
					["Editing file", "Edited file"],
					{ subject: PathUtils.name(part.args) },
				]),
				language: FileTypeUtils.getLanguage({
					path: part.args.path,
				}),
			};
		} else if (ToolUtils.is(toolsets, part, shell_exec)) {
			const json = ToolUtils.json<typeof shell_exec>(part.result)[0];
			const content = json
				? `# stdin\n${part.args.command.trim()}\n\n${[
						json.stdout ? `# stdout\n${json.stdout.trim()}` : "",
						json.stderr ? `# stderr\n${json.stderr.trim()}` : "",
					]
						.filter(Boolean)
						.join("\n\n")}`
				: undefined;
			const commands = part.args.command
				.split("&&")
				.map((command) => {
					const parts = command
						.split(" ")
						.filter(Boolean)
						.filter((part) => part !== "--");
					return parts
						.slice(
							0,
							parts.findIndex((part) => part.match(/[^A-Za-z0-9-_]/)),
						)
						.join(" ")
						.trim();
				})
				.join(" && ");
			return {
				...base(shell_exec, [
					["Running command", "Ran command"],
					{
						subject: commands,
					},
				]),
				content,
			};
		} else if (ToolUtils.is(toolsets, part, ask_question)) {
			return {
				...base(ask_question, [["Asking a question", "Asked a question"]]),
			};
		}

		return {
			...base(UNKNOWN, [["Using", "Used"], "tool", { subject: part.name }]),
		};
	},

	isRejected: (toolResult?: Extract<zDataPart, { type: "toolResult" }>) => {
		return (
			JSON.stringify(toolResult?.value) ===
			JSON.stringify(ToolCallUtils.rejection)
		);
	},
};
