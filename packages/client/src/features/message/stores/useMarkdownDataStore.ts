import type { zAttachmentPart } from "@tiny-chat/core/src/features/data/types/part.ts";
import { create } from "zustand";

export type AttachmentPart = zAttachmentPart;

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
