import { CommonUtils } from "../../../core/utils/CommonUtils.ts";
import { PathUtils } from "../../file/utils/PathUtils.ts";
import type { zWebContext } from "../../provider/types/web.ts";
import { edit_file } from "../../tool/tools/shell/edit_file.ts";
import { grep_files } from "../../tool/tools/shell/grep_files.ts";
import { read_dir } from "../../tool/tools/shell/read_dir.ts";
import { read_file } from "../../tool/tools/shell/read_file.ts";
import { search_files } from "../../tool/tools/shell/search_files.ts";
import { write_file } from "../../tool/tools/shell/write_file.ts";
import { search_web } from "../../tool/tools/web/search_web.ts";
import { view_web } from "../../tool/tools/web/view_web.ts";
import type { Toolset } from "../../tool/types/tool.ts";
import { ToolUtils } from "../../tool/utils/ToolUtils.ts";
import { SnippetService } from "../services/SnippetService.ts";
import type { ActionState } from "../types/action.ts";
import type { MemoryState } from "../types/memory.ts";
import type { MessageState } from "../types/message.ts";
import type { zToolResultPart } from "../types/part.ts";
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

const SOURCE_DISTANCE_LIMIT = 0.1;

const normalizeKey = (key: string) =>
	key
		.trim()
		.replace(/^["'`]+|["'`]+$/g, "")
		.toLowerCase();

const findClosestSource = ({
	sources,
	key,
}: {
	sources?: Source[];
	key: string;
}) => {
	const normalizedKey = normalizeKey(key);
	if (!normalizedKey) return;

	let closest: { source: Source; distance: number } | undefined;
	for (const source of sources ?? []) {
		const distance = CommonUtils.getDistance(
			normalizeKey(source.key),
			normalizedKey,
		);
		if (!closest || distance < closest.distance) closest = { source, distance };
	}
	return closest && closest.distance < SOURCE_DISTANCE_LIMIT
		? closest.source
		: undefined;
};

const matchClause = ({
	sources,
	clause,
}: {
	sources?: Source[];
	clause: string;
}) => {
	const whole = findClosestSource({ sources, key: clause });
	if (whole) return [whole.key];

	const words = clause.trim().split(/\s+/).filter(Boolean);
	const keys: string[] = [];
	for (let start = 0; start < words.length; ) {
		let match: Source | undefined;
		let end = words.length;
		for (; end > start; end--) {
			match = findClosestSource({
				sources,
				key: words.slice(start, end).join(" "),
			});
			if (match) break;
		}

		if (match) {
			keys.push(match.key);
			start = end;
		} else {
			keys.push(words[start] ?? "");
			start++;
		}
	}
	return keys;
};

export const SourceUtils = {
	/**
	 * Resolves the simple source list emitted by models without requiring a
	 * quoting or escaping format. A complete clause wins first (so file names
	 * may contain spaces), then its longest matching word spans are consumed.
	 */
	matchKeys: ({ sources, keys }: { sources?: Source[]; keys: string }) => {
		const whole = findClosestSource({ sources, key: keys });
		if (whole) return [whole.key];

		return keys
			.split(/[;,\n]+/)
			.flatMap((clause) => matchClause({ sources, clause }))
			.filter(Boolean);
	},

	find: ({
		message,
		toolsets,
	}: {
		message: Pick<MessageState, "data">;
		toolsets: Toolset<any>[];
	}): Source[] => {
		return message.data.flat().flatMap((part, _index, array): Source[] => {
			if (part.type === "attachment" && part.content.type === "web") {
				return [
					{
						key: part.source.replace(/^web:/, ""),
						type: "web",
						value: {
							url: part.source.replace(/^web:/, ""),
							title: part.content.title,
							content: part.content.content,
						},
					},
				];
			}
			if (part.type === "toolCall") {
				const result = array.find(
					(p): p is zToolResultPart =>
						p.type === "toolResult" && p.id === part.id,
				);
				if (ToolUtils.is(toolsets, part, search_web)) {
					const output = ToolUtils.json<typeof search_web>(result, true);
					return (
						output.map((value) => ({
							key: value.url,
							type: "web",
							value,
						})) ?? []
					);
				} else if (ToolUtils.is(toolsets, part, view_web)) {
					const output = ToolUtils.json<typeof view_web>(result);
					return output[0]
						? [{ key: output[0].url, type: "web", value: output[0] }]
						: [];
				} else if (ToolUtils.is(toolsets, part, read_file)) {
					const output = ToolUtils.file(result);
					return output[0]
						? [
								{
									key: part.input.path,
									type: "file",
									value: {
										path: part.input.path,
										directory: false,
									},
								},
							]
						: [];
				} else if (ToolUtils.is(toolsets, part, read_dir)) {
					const output = ToolUtils.json<typeof read_dir>(result, true);
					return output.map((item) => ({
						key: item.path,
						type: "file",
						value: {
							path: item.path,
							directory: item.is_dir,
						},
					}));
				} else if (
					ToolUtils.is(toolsets, part, search_files) ||
					ToolUtils.is(toolsets, part, grep_files)
				) {
					const output = ToolUtils.json<
						typeof grep_files | typeof search_files
					>(result, true);
					return output.map((item) => ({
						key: item.path,
						type: "file",
						value: {
							path: item.path,
							directory: false,
						},
					}));
				} else if (
					ToolUtils.is(toolsets, part, write_file) ||
					ToolUtils.is(toolsets, part, edit_file)
				) {
					const output = ToolUtils.json<typeof write_file | typeof edit_file>(
						result,
					);
					return output[0]
						? [
								{
									key: output[0].path,
									type: "file",
									value: {
										path: output[0].path,
										directory: false,
									},
								},
							]
						: [];
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
		if (!key) console.warn("[SourceUtils] source is missing a key");
		const source = findClosestSource({ sources, key });

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
