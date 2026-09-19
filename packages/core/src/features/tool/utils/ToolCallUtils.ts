import { z } from "zod";
import type { CodeLanguage } from "../../../core/utils/CodeUtils.ts";
import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import type { zDataSimplePart, zTextPart } from "../../data/types/part.ts";
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
import { spawn_subagent } from "../tools/subagents/spawn_subagent.ts";
import { search_web } from "../tools/web/search_web.ts";
import { view_web } from "../tools/web/view_web.ts";
import type { ToolDefinition, Toolset } from "../types/tool.ts";
import { type ToolCall, ToolUtils } from "./ToolUtils.ts";

const UNKNOWN = {
	name: "unknown" as const,
	description: "unknown",
	input: z.unknown(),
	output: z.unknown(),
} satisfies ToolDefinition;

type ToolCallDisplay<T extends ToolDefinition, U extends boolean = false> = {
	name: T["name"];
	status: (string | { subject: string })[];
	approval?: "pending" | "approved" | "rejected";
	feedback?: "pending" | "complete";
	feedbackDefault?: z.infer<T["feedback"]>;
	result: "pending" | "success" | "error";
	input: z.infer<T["input"]>;
	output?: U extends true ? z.infer<T["output"]>[] : z.infer<T["output"]>;
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
	| ToolCallDisplay<typeof spawn_subagent>
	| ToolCallDisplay<typeof UNKNOWN>;

/**
 * `getDisplay` builds fresh arrays (`status`, `output`) on every call, so its
 * result can never be compared by reference downstream. `DataUtils` also hands
 * out a new wrapper object for each tool call on every render, which rules out
 * keying a cache on the part itself.
 *
 * The fields the display is derived from — `input`, `result`, `validation` — are
 * carried through that wrapper by reference and are only ever replaced whole,
 * never mutated in place, so they make a sound identity key. Caching on them
 * means a settled tool call keeps one display object for the life of the
 * message, which is what lets `ToolCall` memoize on `display` by equality.
 */
interface DisplayCacheEntry {
	name: string;
	input: unknown;
	result: unknown;
	validation: unknown;
	display: ToolCallDisplayType;
}

/** Keyed by toolsets first so a toolset change drops the whole cache. */
const displayCache = new WeakMap<
	Toolset<any>[],
	Map<string, DisplayCacheEntry>
>();

const __rejection = {
	type: "text",
	value: "[Tool call rejected by user]",
} satisfies Omit<zTextPart, "id">;

export const ToolCallUtils = {
	isRejection: (output: zDataSimplePart[]) => {
		return (
			output.length === 1 &&
			output[0].type === "text" &&
			output[0].value === __rejection.value
		);
	},

	getRejection: (): zDataSimplePart[] => {
		return [
			{
				id: CommonUtils.getRandomId(),
				...__rejection,
			},
		];
	},

	getDisplay: ({
		part,
		toolsets,
	}: {
		part: Extract<RenderedPart, { type: "toolCall" }>;
		toolsets: Toolset<any>[];
	}): ToolCallDisplayType => {
		let cache = displayCache.get(toolsets);
		if (!cache) {
			cache = new Map();
			displayCache.set(toolsets, cache);
		}

		const cached = cache.get(part.id);
		if (
			cached &&
			cached.name === part.name &&
			cached.input === part.input &&
			cached.result === part.result &&
			cached.validation === part.validation
		) {
			return cached.display;
		}

		const display = ToolCallUtils._createDisplay({ part, toolsets });
		cache.set(part.id, {
			name: part.name,
			input: part.input,
			result: part.result,
			validation: part.validation,
			display,
		});
		return display;
	},

	/** Uncached builder. Call `getDisplay` instead. */
	_createDisplay: ({
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
				approval: part.validation?.approval
					? part.result === undefined
						? "pending"
						: ToolCallUtils.isRejection(part.result.output)
							? "rejected"
							: "approved"
					: undefined,
				feedback: tool?.feedback
					? part.result === undefined
						? "pending"
						: "complete"
					: undefined,
				input: part.input as z.infer<T["input"]>,
				output: (multiple
					? ToolUtils.json<T>(part.result, true)
					: ToolUtils.json<T>(part.result)[0]) as U extends true
					? z.infer<T["output"]>[]
					: z.infer<T["output"]>,
			}) satisfies ToolCallDisplay<any>;

		if (ToolUtils.is(toolsets, part, search_web)) {
			return {
				...base(
					search_web,
					[
						["Searching web for", "Searched web for"],
						{ subject: part.input.query },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, view_web)) {
			return {
				...base(view_web, [
					["Viewing link", "Viewed link"],
					{ subject: PathUtils.name(part.input.url) },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, create_action)) {
			return {
				...base(create_action, [
					["Scheduling action", "Scheduled action"],
					{ subject: part.input.prompt },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, update_action)) {
			return {
				...base(update_action, [
					["Updating action", "Updated action"],
					{ subject: part.input.prompt },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, delete_action)) {
			return {
				...base(delete_action, [
					["Deleting action", "Deleted action"],
					{ subject: part.input.reason },
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
					{ subject: part.input.fact },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, update_memory)) {
			return {
				...base(update_memory, [
					["Updating memory", "Updated memory"],
					{ subject: part.input.fact },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, delete_memory)) {
			return {
				...base(delete_memory, [
					["Deleting memory", "Deleted memory"],
					{ subject: part.input.reason },
				]),
			};
		} else if (ToolUtils.is(toolsets, part, search_memories)) {
			return {
				...base(
					search_memories,
					[
						["Searching memory for", "Searched memory for"],
						{ subject: part.input.query },
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
						{ subject: part.input.query },
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
						{ subject: PathUtils.name(part.input.path) },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, find_files)) {
			return {
				...base(
					find_files,
					[
						["Looking for", "Looked for"],
						{ subject: part.input.pattern },
						["in", "in"],
						{ subject: PathUtils.name(part.input.path) },
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
						{ subject: part.input.query },
					],
					true,
				),
			};
		} else if (ToolUtils.is(toolsets, part, grep_files)) {
			return {
				...base(
					grep_files,
					[
						["Grepping", "Grepped"],
						{ subject: part.input.query },
						["in", "in"],
						{ subject: PathUtils.name(part.input.path) },
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
					{ subject: PathUtils.name(part.input.path) },
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
					{ subject: PathUtils.name(part.input.path) },
				]),
				language: FileTypeUtils.getLanguage({
					path: part.input.path,
				}),
			};
		} else if (ToolUtils.is(toolsets, part, edit_file)) {
			return {
				...base(edit_file, [
					["Editing file", "Edited file"],
					{ subject: PathUtils.name(part.input.path) },
				]),
				language: FileTypeUtils.getLanguage({
					path: part.input.path,
				}),
			};
		} else if (ToolUtils.is(toolsets, part, shell_exec)) {
			const json = ToolUtils.json<typeof shell_exec>(part.result)[0];
			const content = json
				? `# stdin\n${part.input.command.trim()}\n\n${[
						json.stdout ? `# stdout\n${json.stdout.trim()}` : "",
						json.stderr ? `# stderr\n${json.stderr.trim()}` : "",
					]
						.filter(Boolean)
						.join("\n\n")}`
				: undefined;
			// TODO - fix type inference
			const commands = (part as ToolCall<typeof shell_exec>).input.command
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
		} else if (ToolUtils.is(toolsets, part, spawn_subagent)) {
			return {
				...base(spawn_subagent, [
					["Using subagent", "Used subagent"],
					{ subject: part.input.task },
				]),
			} satisfies ToolCallDisplay<typeof spawn_subagent>;
		}

		return {
			...base(UNKNOWN, [["Using tool", "Used tool"], { subject: part.name }]),
		};
	},
};
