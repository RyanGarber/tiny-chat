import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type {
	zData,
	zDataPart,
} from "@tiny-chat/core/src/features/data/types/message.ts";
import { DirectiveUtils } from "@tiny-chat/core/src/features/data/utils/DirectiveUtils.ts";
import { useMarkdownDataStore } from "../stores/useMarkdownDataStore.ts";

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
				.filter(
					(part): part is Extract<zDataPart, { type: "attachment" }> =>
						part.type === "attachment",
				);
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
} as const;
