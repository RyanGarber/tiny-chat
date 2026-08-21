import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zWebContext } from "../../provider/types/web.ts";
import { grep_files } from "../../tool/tools/shell/grep_files.ts";
import { read_dir } from "../../tool/tools/shell/read_dir.ts";
import { read_file } from "../../tool/tools/shell/read_file.ts";
import { search_files } from "../../tool/tools/shell/search_files.ts";
import { search_web } from "../../tool/tools/web/search_web.ts";
import { view_web } from "../../tool/tools/web/view_web.ts";
import type { Toolset } from "../../tool/types/tool.ts";
import { ToolUtils } from "../../tool/utils/ToolUtils.ts";
import { SnippetService } from "../services/SnippetService.ts";
import type { ActionState } from "../types/action.ts";
import type { MemoryState } from "../types/memory.ts";
import type { MessageState, zDataPart } from "../types/message.ts";
import { DataUtils } from "./DataUtils.ts";

export type Source = { key: string } & (
	| {
			type: "web";
			value: zWebContext;
	  }
	| { type: "memory"; value: MemoryState }
	| { type: "action"; value: ActionState }
	| { type: "file"; value: { path: string; directory: boolean } }
);

type SourceDisplay<T extends Source["type"] | "unknown"> =
	(T extends Source["type"]
		? Extract<Source, { type: T }>
		: { type: "unknown" }) & {
		emoji: string;
		title: string;
		description: string;
	};

type SourceDisplayType =
	| SourceDisplay<"web">
	| SourceDisplay<"memory">
	| SourceDisplay<"action">
	| SourceDisplay<"file">
	| SourceDisplay<"unknown">;

export const SourceUtils = {
	find: ({
		message,
		toolsets,
	}: {
		message: MessageState;
		toolsets: Toolset<any>[];
	}): Source[] => {
		return message.data.flat().flatMap((part, _index, array): Source[] => {
			if (part.type === "toolResult") {
				const { tool } = ToolUtils.find({ toolsets, part });
				if (tool?.name === search_web.name) {
					const output = ToolUtils.json<typeof search_web>(part, true);
					return (
						output.map((value) => ({
							key: value.url,
							type: "web",
							value,
						})) ?? []
					);
				} else if (tool?.name === view_web.name) {
					const output = ToolUtils.json<typeof view_web>(part);
					return output[0]
						? [{ key: output[0].url, type: "web", value: output[0] }]
						: [];
				} else if (tool?.name === read_file.name) {
					const output = ToolUtils.file(part);
					const toolCall = array.find(
						(p): p is Extract<zDataPart, { type: "toolCall" }> =>
							p.type === "toolCall" && p.id === part.id,
					);
					if (toolCall && ToolUtils.is(toolsets, toolCall, read_file)) {
						return output.map((file) => ({
							key: toolCall.args.path ?? file.name,
							type: "file",
							value: {
								path: toolCall.args.path ?? file.name,
								directory: false,
							},
						}));
					}
				} else if (tool?.name === read_dir.name) {
					const output = ToolUtils.json<typeof read_dir>(part, true);
					return output.map((item) => ({
						key: item.path,
						type: "file",
						value: {
							path: item.path,
							directory: item.is_dir,
						},
					}));
				} else if (
					tool?.name === grep_files.name ||
					tool?.name === search_files.name
				) {
					const output = ToolUtils.json<
						typeof grep_files | typeof search_files
					>(part, true);
					return output.map((item) => ({
						key: item.path,
						type: "file",
						value: {
							path: item.path,
							directory: false,
						},
					}));
				}
			}
			return [];
		});
	},

	getDisplay: ({
		sources,
		key,
		text,
	}: {
		sources?: Source[];
		key: string;
		text: string;
	}): SourceDisplayType => {
		const source = sources?.find((source) => {
			if (!key) {
				console.warn("[SourceUtils] source is missing a key:", source);
				return false;
			}
			return CommonUtils.getDistance(source.key, key) < 0.1;
		});

		if (source?.type === "web") {
			return {
				...source,
				emoji: "🔗",
				title: source.value.title ?? key,
				description: SnippetService.getSnippet({
					text: source.value.content,
					query: text,
				}),
			};
		} else if (source?.type === "memory") {
			return {
				...source,
				emoji: "🧠",
				title: source.value.fact,
				description: `Learned ${CommonUtils.formatDate({ date: source.value.createdAt, relative: true })}.`,
			};
		} else if (source?.type === "action") {
			return {
				...source,
				emoji: "⚡",
				title: DataUtils.getTextCleaned({ data: source.value.data }),
				description: source.value.nextRunAt
					? `Next run ${CommonUtils.formatDate({ date: source.value.nextRunAt, relative: true })}.`
					: "All runs completed.",
			};
		} else if (source?.type === "file") {
			return {
				...source,
				emoji: "📎",
				title: PathUtils.name(source.value.path),
				description: source.value.path,
			};
		} else {
			return {
				type: "unknown",
				title: key,
				description: "Source not found",
				emoji: "❔",
			};
		}
	},
} as const;
