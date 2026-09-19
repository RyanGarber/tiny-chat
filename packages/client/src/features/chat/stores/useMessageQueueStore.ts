import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { TypeUtils } from "@tiny-chat/core/src/core/utils/TypeUtils.ts";
import type {
	zData,
	zDataSimplePart,
	zInterjectionPart,
} from "@tiny-chat/core/src/features/data/types/part.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { EditorPartUtils } from "@tiny-chat/core/src/features/data/utils/EditorPartUtils.ts";
import { create } from "zustand";

interface MessageQueueStore {
	active: Record<string, boolean>;
	setActive: (chatId: string, active: boolean) => void;
	queues: Record<string, zInterjectionPart[]>;
	enqueue: (chatId: string, data: zData) => void;
	drain: (chatId: string) => zInterjectionPart[];
	remove: (chatId: string, id: string) => void;
	clear: (chatId: string) => void;
	finish: (chatId: string, data: zData, failed?: boolean) => void;
}
export const useMessageQueueStore = create<MessageQueueStore>((set, get) => ({
	finish: (chatId, data, failed = false) => {
		if (
			failed ||
			!DataUtils.isMissingToolResult({ data }) ||
			data.flat().some((part) => part.type === "abort")
		) {
			get().clear(chatId);
			get().setActive(chatId, false);
		}
	},
	active: {},
	setActive: (chatId, active) =>
		set((state) => ({ active: { ...state.active, [chatId]: active } })),
	queues: {},
	enqueue: (chatId, data) => {
		const value = data.flat().flatMap((part): zDataSimplePart[] => {
			if (part.type === "interjection") return part.value;
			if (
				part.type === "text" ||
				part.type === "json" ||
				part.type === "file" ||
				part.type === "attachment"
			) {
				return [part];
			}
			// An interjection only carries the simple parts, so the ones that
			// are not go in as the Markdown they read as.
			if (EditorPartUtils.is(part)) {
				return [
					{
						id: part.id,
						type: "text",
						value: EditorPartUtils.toMarkdown(part),
					},
				];
			}
			return [];
		});
		if (!value.length) return;
		const part: zInterjectionPart = {
			id: CommonUtils.getRandomId(),
			type: "interjection",
			value: TypeUtils.deepClone(value),
		};
		set((state) => ({
			queues: {
				...state.queues,
				[chatId]: [...(state.queues[chatId] ?? []), part],
			},
		}));
	},
	drain: (chatId) => {
		const parts = get().queues[chatId] ?? [];
		get().clear(chatId);
		return parts;
	},
	remove: (chatId, id) =>
		set((state) => ({
			queues: {
				...state.queues,
				[chatId]: (state.queues[chatId] ?? []).filter((part) => part.id !== id),
			},
		})),
	clear: (chatId) =>
		set((state) => {
			const queues = { ...state.queues };
			delete queues[chatId];
			return { queues };
		}),
}));
