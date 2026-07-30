import { z } from "zod";
import type { Chat } from "../../../../../server/generated/prisma/browser.ts";

export type ChatState = Chat & {
	messages: {
		createdAt: Date;
	}[];
	folder: {
		title: string | null;
		_count: {
			chats: number;
		};
	};
	unseen: boolean;
};

export type ChatLike = { id: string } | string;
export const ChatLike = z.custom<ChatLike>();

export const zChat = z.object({
	id: z.cuid2(),
	userId: z.string(),
	folderId: z.cuid2(),
	incognito: z.boolean(),
});
export type zChat = z.infer<typeof zChat>;
