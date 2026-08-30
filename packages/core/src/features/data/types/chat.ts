import { z } from "zod";
import type { FieldOutputTypes } from "../../../../generated/prisma/contract.d.ts";
import { zId } from "../../../core/types/common.ts";

export type FolderState = FieldOutputTypes["public"]["Folder"] & {
	chats: ChatState[];
};

export type ChatState = FieldOutputTypes["public"]["Chat"] & {
	messages: Pick<FieldOutputTypes["public"]["Message"], "createdAt">[];
	unseen: boolean;
};

export type ChatLike = { id: string } | string;
export const ChatLike = z.custom<ChatLike>();

export const zChat = z.object({
	id: zId,
	userId: z.string(),
	folderId: zId.nullable(),
	incognito: z.boolean(),
	temporary: z.boolean(),
});
export type zChat = z.infer<typeof zChat>;
