import type { zDataPart } from "@tiny-chat/core/src/features/data/types/message.ts";
import { create } from "zustand";

export type AttachmentPart = Extract<zDataPart, { type: "attachment" }>;

interface AttachmentStore {
	attachments: Record<string, AttachmentPart>;
	setAttachments: (attachments: AttachmentPart[]) => void;
	addAttachment: (attachment: AttachmentPart) => void;
}

export const useMarkdownDataStore = create<AttachmentStore>((set) => ({
	attachments: {},
	setAttachments: (attachments) =>
		set({
			attachments: Object.fromEntries(
				attachments.map((attachment) => [attachment.id, attachment]),
			),
		}),
	addAttachment: (attachment) =>
		set((state) => ({
			attachments: { ...state.attachments, [attachment.id]: attachment },
		})),
}));
