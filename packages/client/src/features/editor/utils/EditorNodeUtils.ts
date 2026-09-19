import { CodeUtils } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { EditorPartUtils } from "@tiny-chat/core/src/features/data/utils/EditorPartUtils.ts";
import {
	type EditorPart,
	useEditorPartStore,
} from "../stores/useEditorPartStore.ts";
import type { EditorNode } from "../types/node.ts";
import { PasteUtils } from "./PasteUtils.ts";

export const EditorNodeUtils = {
	/** Take a part into the registry and hand back the pointer standing for it. */
	create: (part: EditorPart): EditorNode => {
		useEditorPartStore.getState().addPart(part);
		return { type: part.type, id: part.id };
	},

	quote: ({ model, text }: { model: string; text: string }): EditorNode =>
		EditorNodeUtils.create({
			id: CommonUtils.getRandomId(),
			type: "quote",
			model,
			text,
		}),

	command: ({
		name,
		value,
		argument,
	}: {
		name: string;
		value?: string;
		argument?: string;
	}): EditorNode =>
		EditorNodeUtils.create({
			id: CommonUtils.getRandomId(),
			type: "command",
			name,
			value,
			argument,
		}),

	/** Null means the runtime should leave the paste to its editor package. */
	paste: (text: string, collapse = true): EditorNode | null => {
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

		return EditorNodeUtils.create({
			id: CommonUtils.getRandomId(),
			type: "paste",
			text: body,
			lines: PasteUtils.lines(body).length,
			language,
			collapsed,
		});
	},

	/** The part a node points at, or null once it has gone out of the registry. */
	part: (node: EditorNode) => {
		const part = useEditorPartStore.getState().parts[node.id];
		return part?.type === node.type ? part : null;
	},

	toMarkdown: (node: EditorNode): string => EditorPartUtils.toPointer(node),
} as const;
