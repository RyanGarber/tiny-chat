import type { z } from "zod";
import type { zDataBasicPart, zDataPart } from "../../data/types/message.ts";
import { DataUtils } from "../../data/utils/DataUtils.ts";
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
import { read_dir } from "../tools/shell/read_dir.ts";
import { read_file } from "../tools/shell/read_file.ts";
import { search_files } from "../tools/shell/search_files.ts";
import { shell_exec } from "../tools/shell/shell_exec.ts";
import { write_file } from "../tools/shell/write_file.ts";
import { search_web } from "../tools/web/search_web.ts";
import { view_web } from "../tools/web/view_web.ts";
import type { Toolset } from "../types/tool.ts";
import { ToolUtils } from "./ToolUtils.ts";

export type ToolCallDetails =
	| {
			kind: "search_web";
			results: Array<{ title?: string; url: string; content: string }>;
	  }
	| {
			kind: "view_web";
			title?: string;
			url: string;
			content: string;
	  }
	| {
			kind: "action_mutation";
			message: string;
	  }
	| {
			kind: "list_actions";
			actions: Array<{
				id: string;
				prompt: string;
				chat_id: string;
				nextRunAt?: Date | string | null;
			}>;
	  }
	| {
			kind: "search_chats";
			results: Array<{ chat_title: string | null; snippet: string }>;
	  }
	| {
			kind: "memory_mutation";
			message: string;
	  }
	| {
			kind: "search_memories";
			results: Array<{ fact: string; created_at: Date | string }>;
	  }
	| {
			kind: "read_file";
			path: string;
			name: string;
			mime?: string;
			data?: string;
			text?: string;
			isImage?: boolean;
	  }
	| {
			kind: "write_file";
			path: string;
			name: string;
			content: string;
			extension?: string;
	  }
	| {
			kind: "read_dir";
			path: string;
			items: Array<{ path: string; name: string; is_dir: boolean }>;
	  }
	| {
			kind: "search_files";
			results: Array<{ path: string; name: string; snippet: string }>;
	  }
	| {
			kind: "shell_exec";
			command: string;
			stdout: string;
			stderr: string;
			/** Combined stdin/stdout/stderr block suitable for a code view */
			code: string;
	  }
	| {
			kind: "fallback";
			args: unknown;
			value?: unknown;
	  };

/**
 * Platform-agnostic display data for a tool call.
 * Consumers render `status` / `highlight` / `details` however they like.
 */
export type ToolCallDisplay = {
	pending: boolean;
	error?: boolean;
	/** Full status line, e.g. "Searching web for foo..." / "Searched web for foo" */
	status: string;
	/** Substring of `status` that should be emphasized when the UI supports it */
	highlight?: string;
	details?: ToolCallDetails;
};

export type ToolCallInputDetails =
	| {
			kind: "shell_exec";
			command: string;
	  }
	| {
			kind: "write_file";
			path: string;
			name: string;
			content: string;
			extension?: string;
	  }
	| {
			kind: "ask_question";
			question: string;
			suggestions: string[];
			answer?: string;
	  };

/**
 * Platform-agnostic display data for a tool call that is waiting on the user.
 */
export type ToolCallInputDisplay = {
	/** Whether the user has yet to respond */
	pending: boolean;
	/** Whether the user has to approve the call before it runs */
	approval: boolean;
	/** Whether the user denied the call */
	rejected: boolean;
	/** What the tool is about to do, e.g. the command to run */
	details?: ToolCallInputDetails;
};

export const ToolCallUtils = {
	rejection: [
		{ type: "json", value: "Tool call rejected by user" },
	] satisfies zDataBasicPart[],

	getStatus: ({
		pending,
		active,
		done,
		highlight,
		around,
	}: {
		pending: boolean;
		active: string;
		done: string;
		highlight?: string;
		around?: [prefix: string, suffix?: string];
	}) => {
		const verb = pending ? active : done;
		const [prefix = "", suffix = ""] = around ?? ["", ""];
		const middle = highlight
			? `${prefix}${highlight}${suffix}`
			: `${prefix}${suffix}`.trimEnd();
		const body = middle ? `${verb} ${middle}` : verb;
		return {
			status: pending ? `${body}...` : body,
			highlight,
		};
	},

	getDisplay: ({
		toolCall,
		toolResult,
		toolsets,
		actions,
	}: {
		toolCall: Extract<zDataPart, { type: "toolCall" }>;
		toolResult?: Extract<zDataPart, { type: "toolResult" }>;
		toolsets: Toolset<any>[];
		actions?: Array<{ id: string; nextRunAt?: Date | string | null }>;
	}): ToolCallDisplay => {
		const pending = !toolResult;
		const error = toolResult?.error;
		const { tool } = ToolUtils.find({ toolsets, name: toolCall.name });

		const base = { pending, error };

		if (tool?.name === search_web.name) {
			const query = (toolCall.args as z.infer<typeof search_web.input>).query;
			const results =
				ToolCallUtils.getOutput<z.infer<typeof search_web.output>>(toolResult);
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Searching",
					done: "Searched",
					highlight: query,
					around: ["web for "],
				}),
				details: results ? { kind: "search_web", results } : undefined,
			};
		}

		if (tool?.name === view_web.name) {
			const url = (toolCall.args as z.infer<typeof view_web.input>).url;
			const output =
				ToolCallUtils.getOutput<z.infer<typeof view_web.output>>(toolResult);
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Viewing",
					done: "Viewed",
					highlight: url,
				}),
				details: output
					? {
							kind: "view_web",
							title: output.title,
							url: output.url,
							content: output.content,
						}
					: undefined,
			};
		}

		if (
			tool?.name === create_action.name ||
			tool?.name === update_action.name ||
			tool?.name === delete_action.name
		) {
			const isDelete = tool.name === delete_action.name;
			const highlight = DataUtils.getTextCleaned({
				data:
					(
						toolCall.args as
							| z.infer<typeof create_action.input>
							| z.infer<typeof update_action.input>
					).prompt ??
					(toolCall.args as z.infer<typeof delete_action.input>).reason,
			});
			const output =
				ToolCallUtils.getOutput<Record<string, string>>(toolResult);
			let details: ToolCallDetails | undefined;
			if (output) {
				const message =
					tool.name === create_action.name
						? `Created action with ID: ${(output as z.infer<typeof create_action.output>).created_action_id}.`
						: tool.name === update_action.name
							? `Updated action with ID: ${(output as z.infer<typeof update_action.output>).updated_action_id}.`
							: `Removed action with ID: ${(output as z.infer<typeof delete_action.output>).deleted_action_id}.`;
				details = { kind: "action_mutation", message };
			}
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: isDelete ? "Canceling" : "Scheduling",
					done: isDelete ? "Canceled" : "Scheduled",
					highlight,
					around: ["action "],
				}),
				details,
			};
		}

		if (tool?.name === list_actions.name) {
			const listed =
				ToolCallUtils.getOutput<z.infer<typeof list_actions.output>>(
					toolResult,
				);
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Checking",
					done: "Checked",
					around: ["scheduled actions"],
				}),
				details: listed
					? {
							kind: "list_actions",
							actions: listed.map((action) => ({
								...action,
								nextRunAt: actions?.find((a) => a.id === action.id)?.nextRunAt,
							})),
						}
					: undefined,
			};
		}

		if (tool?.name === search_chats.name) {
			const query = (toolCall.args as z.infer<typeof search_chats.input>).query;
			const results =
				ToolCallUtils.getOutput<z.infer<typeof search_chats.output>>(
					toolResult,
				);
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Searching",
					done: "Searched",
					highlight: query,
					around: ["chats for "],
				}),
				details: results ? { kind: "search_chats", results } : undefined,
			};
		}

		if (
			tool?.name === create_memory.name ||
			tool?.name === update_memory.name ||
			tool?.name === delete_memory.name
		) {
			const highlight =
				(
					toolCall.args as
						| z.infer<typeof create_memory.input>
						| z.infer<typeof update_memory.input>
				).fact ?? (toolCall.args as z.infer<typeof delete_memory.input>).reason;
			const output =
				ToolCallUtils.getOutput<Record<string, string>>(toolResult);
			let details: ToolCallDetails | undefined;
			if (output) {
				const message =
					tool.name === create_memory.name
						? `Created memory with ID: ${(output as z.infer<typeof create_memory.output>).created_memory_id}.`
						: tool.name === update_memory.name
							? `Updated memory with ID: ${(output as z.infer<typeof update_memory.output>).updated_memory_id}.`
							: `Removed memory with ID: ${(output as z.infer<typeof delete_memory.output>).deleted_memory_id}.`;
				details = { kind: "memory_mutation", message };
			}
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Remembering",
					done: "Remembered",
					highlight,
				}),
				details,
			};
		}

		if (tool?.name === search_memories.name) {
			const query = (toolCall.args as z.infer<typeof search_memories.input>)
				.query;
			const results =
				ToolCallUtils.getOutput<z.infer<typeof search_memories.output>>(
					toolResult,
				);
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Searching",
					done: "Searched",
					highlight: query,
					around: ["memories for "],
				}),
				details: results ? { kind: "search_memories", results } : undefined,
			};
		}

		if (tool?.name === read_file.name && toolCall.args?.path) {
			const input = toolCall.args as z.infer<typeof read_file.input>;
			const name = PathUtils.name(input);
			const file =
				toolResult?.value?.[0]?.type === "file"
					? toolResult.value[0]
					: undefined;
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Reading",
					done: "Read",
					highlight: name,
				}),
				details: {
					kind: "read_file",
					path: input.path,
					name: file?.name ?? name,
					...(file
						? {
								mime: file.mime,
								data: file.data,
								text: file.mime.startsWith("image/")
									? undefined
									: (FileUtils.getTextFromBytes(file) ?? undefined),
								isImage: file.mime.startsWith("image/"),
							}
						: {}),
				},
			};
		}

		if (tool?.name === write_file.name) {
			const input = toolCall.args as z.infer<typeof write_file.input>;
			const name = PathUtils.name(input);
			const succeeded = !!ToolCallUtils.getOutput(toolResult);
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Writing",
					done: "Wrote",
					highlight: name,
					around: ["file "],
				}),
				details: succeeded
					? {
							kind: "write_file",
							path: input.path,
							name,
							content: input.content,
							extension: FileTypeUtils.getExtension(input),
						}
					: undefined,
			};
		}

		if (tool?.name === read_dir.name) {
			const input = toolCall.args as z.infer<typeof read_dir.input>;
			const name = PathUtils.name(input);
			const items =
				ToolCallUtils.getOutput<z.infer<typeof read_dir.output>>(toolResult);
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Looking",
					done: "Looked",
					highlight: name,
					around: ["in folder "],
				}),
				details: items
					? {
							kind: "read_dir",
							path: input.path,
							items: items.map((item) => ({
								path: item.path,
								name: PathUtils.name(item),
								is_dir: item.is_dir,
							})),
						}
					: undefined,
			};
		}

		if (tool?.name === search_files.name) {
			const query = (toolCall.args as z.infer<typeof search_files.input>).query;
			const results =
				ToolCallUtils.getOutput<z.infer<typeof search_files.output>>(
					toolResult,
				);
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Searching",
					done: "Searched",
					highlight: query,
					around: ["files for "],
				}),
				details: results
					? {
							kind: "search_files",
							results: results.map((upload) => ({
								path: upload.path,
								name: PathUtils.name(upload),
								snippet: upload.snippet,
							})),
						}
					: undefined,
			};
		}

		if (tool?.name === ask_question.name) {
			return {
				...base,
				status: pending ? "Asking a question..." : "Asked a question",
			};
		}

		if (tool?.name === shell_exec.name) {
			const command = (toolCall.args as z.infer<typeof shell_exec.input>)
				.command;
			const highlight = command.split(" ")[0];
			const output =
				ToolCallUtils.getOutput<z.infer<typeof shell_exec.output>>(toolResult);
			let details: ToolCallDetails | undefined;
			if (output) {
				const parts = [
					output.stdout ? `# stdout\n${output.stdout.trim()}` : "",
					output.stderr ? `# stderr\n${output.stderr.trim()}` : "",
				].filter(Boolean);
				details = {
					kind: "shell_exec",
					command,
					stdout: output.stdout,
					stderr: output.stderr,
					code: `# stdin\n${command.trim()}\n\n${parts.join("\n\n")}`,
				};
			}
			return {
				...base,
				...ToolCallUtils.getStatus({
					pending,
					active: "Running",
					done: "Ran",
					highlight,
				}),
				details,
			};
		}

		return {
			...base,
			...ToolCallUtils.getStatus({
				pending,
				active: "Using",
				done: "Used",
				highlight: toolCall.name,
			}),
			details: {
				kind: "fallback",
				args: toolCall.args,
				value: toolResult?.value,
			},
		};
	},

	/**
	 * Display data for the input a tool call is waiting on, or `undefined` when
	 * the tool runs without asking the user anything.
	 */
	getInput: ({
		toolCall,
		toolResult,
		toolsets,
	}: {
		toolCall: Extract<zDataPart, { type: "toolCall" }>;
		toolResult?: Extract<zDataPart, { type: "toolResult" }>;
		toolsets: Toolset<any>[];
	}): ToolCallInputDisplay | undefined => {
		const { tool } = ToolUtils.find({ toolsets, name: toolCall.name });
		if (!tool?.feedback && !tool?.approval) return undefined;

		const pending = !toolResult;

		const base = {
			pending,
			approval: !!tool.approval,
			rejected: ToolCallUtils.isRejected(toolResult),
		};

		if (tool.name === shell_exec.name) {
			const { command } = toolCall.args as z.infer<typeof shell_exec.input>;
			return {
				...base,
				details: { kind: "shell_exec", command },
			};
		}

		if (tool.name === write_file.name) {
			const input = toolCall.args as z.infer<typeof write_file.input>;
			return {
				...base,
				details: {
					kind: "write_file",
					path: input.path,
					name: PathUtils.name(input),
					content: input.content,
					extension: FileTypeUtils.getExtension(input),
				},
			};
		}

		if (tool.name === ask_question.name) {
			const input = toolCall.args as z.infer<typeof ask_question.input>;
			const output =
				ToolCallUtils.getOutput<z.infer<typeof ask_question.output>>(
					toolResult,
				);
			return {
				...base,
				details: {
					kind: "ask_question",
					question: input.question,
					suggestions: input.suggestions ?? [],
					answer: output?.answer,
				},
			};
		}

		return base;
	},

	isRejected: (toolResult?: Extract<zDataPart, { type: "toolResult" }>) => {
		return (
			JSON.stringify(toolResult?.value) ===
			JSON.stringify(ToolCallUtils.rejection)
		);
	},

	getOutput: <T>(toolResult?: Extract<zDataPart, { type: "toolResult" }>) => {
		if (toolResult?.value?.[0]?.type === "json") {
			return toolResult.value[0].value as T;
		}
	},
};
