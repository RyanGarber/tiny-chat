import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { SnippetService } from "@tiny-chat/core/src/features/data/services/SnippetService.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { MarkdownSource } from "../components/MarkdownContext.tsx";

type SourceDisplay<T extends MarkdownSource["type"] | "unknown"> =
	(T extends MarkdownSource["type"]
		? Extract<MarkdownSource, { type: T }>
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
	getDisplay: ({
		sources,
		key,
		text,
	}: {
		sources?: MarkdownSource[];
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
				title: PathUtils.name(source.value.uri),
				description: source.value.uri,
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
