import type { zData, zDataPart } from "@tiny-chat/shared/src/types/chat.ts";
import { texts } from "@tiny-chat/shared/src/utils.ts";
import { useInputStore } from "#frontend/features/chat/stores/useInputStore.ts";

export const InputService = {
	insertQuote: (model: string, text: string) => {
		const { editor } = useInputStore.getState();
		if (!editor) return;

		editor.commands.insertContent({
			type: "quote",
			attrs: { model },
			content: [{ type: "paragraph", content: [{ type: "text", text }] }],
		});
	},

	getData: (): zData => {
		const { editor, attachments } = useInputStore.getState();
		if (!editor) return [];

		const data: zDataPart[] = [...attachments];
		if (editor.getMarkdown().trim().length)
			data.push({ type: "text", value: editor.getMarkdown() });
		return [data];
	},

	setData: (data: zData) => {
		const { editor, setAttachments } = useInputStore.getState();
		if (!editor) return;

		editor.commands.setContent(texts(data, "\n"), {
			contentType: "markdown",
		});
		setAttachments(data.flat().filter((p) => p.type === "upload"));
	},
} as const;
