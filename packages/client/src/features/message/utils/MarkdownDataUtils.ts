import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type {
	zData,
	zDataPart,
	zTextPart,
} from "@tiny-chat/core/src/features/data/types/part.ts";
import { DirectiveUtils } from "@tiny-chat/core/src/features/data/utils/DirectiveUtils.ts";
import {
	EDITOR_PART_TYPES,
	EditorPartUtils,
	type zEditorPart,
} from "@tiny-chat/core/src/features/data/utils/EditorPartUtils.ts";
import { useEditorPartStore } from "../../editor/stores/useEditorPartStore.ts";

const text = (value: string): zTextPart => ({
	id: CommonUtils.getRandomId(),
	type: "text",
	value,
});

/**
 * Markdown and `zData`, which are two views of the same message: a document
 * the editor can be typed into, and the parts it is carried and read as.
 *
 * The editor only ever holds `:tag[]{id}` for a part; `store` swaps those
 * pointers for the parts themselves on the way out, and refills the registry
 * on the way back in.
 */
export const MarkdownDataUtils = {
	fromMarkdown: (markdown: string, store = false): zData => {
		const parts = DirectiveUtils.extractFromMarkdown(
			markdown,
			...EDITOR_PART_TYPES,
		).flatMap(({ text: raw, directive }): zDataPart[] => {
			if (!directive) return raw ? [text(raw)] : [];

			if (store) {
				const part =
					useEditorPartStore.getState().parts[directive.attributes.id];
				if (part?.type === directive.tag) return [part];
			}

			// A pointer with nothing behind it says nothing on its own, so it is
			// left as the text it was written as rather than dropped silently.
			return [text(raw)];
		});

		return [parts.filter((part) => part.type !== "text" || part.value.length)];
	},

	toMarkdown: (data: zData, store = false): string => {
		const parts = data.flat();

		if (store) {
			useEditorPartStore.getState().setParts(parts.filter(EditorPartUtils.is));
		}

		return parts
			.flatMap((part) => {
				if (part.type === "text") return [part.value];
				if (!EditorPartUtils.is(part)) return [];

				const pointer = EditorPartUtils.toPointer(part);
				return [
					EditorPartUtils.isInline(part.type) ? pointer : `\n${pointer}\n`,
				];
			})
			.join("");
	},

	/**
	 * Collect a run of inline data parts to render in a single Markdown block.
	 */
	toInlineParts: (parts: readonly (zDataPart | { type: "group" })[]) => {
		const run: (zTextPart | zEditorPart)[] = [];
		for (const part of parts) {
			if (part.type === "group") break;
			if (part.type !== "text" && !EditorPartUtils.is(part)) break;
			run.push(part);
		}
		return run;
	},

	/**
	 * Rebuild the editor's inline Markdown stream from structured message parts.
	 * No separator is introduced around an inline part: the surrounding text
	 * parts already own every intentional space (or lack of one) on either side
	 * of one. A block part is given the lines it needs to parse as a block.
	 */
	toInlineBlock: (data: zData): string =>
		data
			.flat()
			.flatMap((part) => {
				if (part.type === "text") return [part.value];
				if (!EditorPartUtils.is(part)) return [];

				const markdown = EditorPartUtils.toMarkdown(part);
				return [
					EditorPartUtils.isInline(part.type)
						? markdown
						: `\n\n${markdown}\n\n`,
				];
			})
			.join(""),
} as const;
