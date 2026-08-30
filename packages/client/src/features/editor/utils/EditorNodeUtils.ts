import { CodeUtils } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import type { EditorNode } from "../types/node.ts";
import { PasteUtils } from "./PasteUtils.ts";

export const EditorNodeUtils = {
	quote: ({ model, text }: { model: string; text: string }): EditorNode => ({
		type: "quote",
		model,
		text,
	}),

	/** Null means the runtime should leave the paste to its editor package. */
	paste: (
		text: string,
		collapse = true,
	): Extract<EditorNode, { type: "paste" }> | null => {
		const pasted = PasteUtils.normalize(text);
		if (!pasted) return null;

		const unwrapped = PasteUtils.unwrapFence(pasted.trim());
		const body = unwrapped?.text ?? pasted;
		const detected = PasteUtils.detectCode(body);
		const language =
			CodeUtils.getLanguage(unwrapped?.language ?? null) ??
			detected?.language ??
			null;
		const collapsed = collapse && PasteUtils.isLong(body);
		if (!collapsed && !unwrapped && !detected) return null;

		return {
			type: "paste",
			text: body,
			lines: PasteUtils.lines(body).length,
			language,
			collapsed,
		};
	},

	toMarkdown: (node: EditorNode): string => {
		if (node.type === "attachment") {
			return `:attachment[]{id="${node.id}"}`;
		}
		if (node.type === "command") {
			const attributes = CommonUtils.toAttributesString({
				name: node.name,
				value: node.value,
			});
			return `:command[${node.value ?? ""}]{${attributes}}`;
		}
		if (node.type === "quote") {
			const attributes = CommonUtils.toAttributesString({ model: node.model });
			return `:::quote{${attributes}}\n${node.text}\n:::`;
		}
		if (node.collapsed) return PasteUtils.markdown(node.text);
		return PasteUtils.fence(node.text, node.language);
	},
} as const;
