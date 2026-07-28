import type {
	zData,
	zDataPart,
} from "@tiny-chat/shared/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/shared/src/features/data/utils/DataUtils.ts";
import { hasPendingCommandNode } from "#frontend/features/input/hooks/useCommand.tsx";
import { useInputStore } from "#frontend/features/input/stores/useInputStore.ts";

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

		console.log(`[InputService] setData:`, data);
		editor.commands.setContent(DataUtils.getText({ data, join: "\n" }), {
			contentType: "markdown",
		});
		setAttachments(data.flat().filter((p) => p.type === "upload"));
	},

	getIncomplete: () => {
		const { editor } = useInputStore.getState();
		if (!editor) return false;

		return hasPendingCommandNode(editor);
	},
} as const;
