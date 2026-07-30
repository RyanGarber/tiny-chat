import type { zData } from "@tiny-chat/core/src/features/data/types/message.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { useInputStore } from "../stores/useInputStore.ts";

export const InputService = {
	getData: (): zData => {
		const content = useInputStore.getState().content;
		return [[{ type: "text", value: content }]];
	},

	setData: (data: zData) => {
		const setContent = useInputStore.getState().setContent;
		setContent(DataUtils.getText({ data }));
	},
} as const;
