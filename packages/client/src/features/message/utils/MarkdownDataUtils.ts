import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type {
	zAttachmentPart,
	zData,
	zDataPart,
	zTextPart,
} from "@tiny-chat/core/src/features/data/types/part.ts";
import { DirectiveUtils } from "@tiny-chat/core/src/features/data/utils/DirectiveUtils.ts";
import { useMarkdownDataStore } from "../stores/useMarkdownDataStore.ts";
import { MarkdownUtils } from "./MarkdownUtils.ts";

export const MarkdownDataUtils = {
	fromMarkdown: (markdown: string, store = false): zData => {
		const parts = DirectiveUtils.extractFromMarkdown(
			markdown,
			"attachment",
		).flatMap(({ text, directive }): zDataPart[] => {
			if (!directive) {
				return text
					? [{ id: CommonUtils.getRandomId(), type: "text", value: text }]
					: [];
			}
			if (store) {
				const id = directive.attributes.id;
				const attachment = useMarkdownDataStore.getState().attachments[id];
				if (attachment) return [attachment];
			}
			return [{ id: CommonUtils.getRandomId(), type: "text", value: text }];
		});
		return [parts.filter((part) => part.type !== "text" || part.value.length)];
	},

	toMarkdown: (data: zData, store = false): string => {
		if (store) {
			const attachments = data
				.flat()
				.filter((part): part is zAttachmentPart => part.type === "attachment");
			useMarkdownDataStore.getState().setAttachments(attachments);
		}

		return data
			.flat()
			.flatMap((part) => {
				if (part.type === "text") return [part.value];
				if (part.type === "attachment") {
					return [`:attachment[]{id="${part.id}"}`];
				}
				return [];
			})
			.join("");
	},

	/**
	 * Collect a run of inline data parts to render in a single Markdown block.
	 */
	toInlineParts: (parts: readonly (zDataPart | { type: "group" })[]) => {
		const run: (zTextPart | zAttachmentPart)[] = [];
		for (const part of parts) {
			if (part.type !== "text" && part.type !== "attachment") break;
			run.push(part);
		}
		return run;
	},

	/**
	 * Rebuild the editor's inline Markdown stream from structured message parts.
	 * No separator is introduced: the surrounding text parts already own every
	 * intentional space (or lack of one) on either side of an attachment.
	 */
	toInlineBlock: (data: zData): string =>
		data
			.flat()
			.flatMap((part) => {
				if (part.type === "text") return [part.value];
				if (part.type !== "attachment") return [];

				const attributes = [
					`source="${MarkdownUtils.escape(part.source)}"`,
					`name="${MarkdownUtils.escape(part.label)}"`,
					...(part.content.type === "directory" ? ['is-directory="true"'] : []),
				].join(" ");
				return [`:attachment[]{${attributes}}`];
			})
			.join(""),
} as const;
