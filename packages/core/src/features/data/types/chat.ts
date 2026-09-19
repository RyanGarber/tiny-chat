import { z } from "zod";
import type { FieldOutputTypes } from "../../../../generated/prisma/contract.d.ts";
import type { Model } from "../../../core/services/PostgresService.ts";

export type FolderState = FieldOutputTypes["public"]["Folder"] & {
	chats: ChatState[];
};

export type FolderLike = { id: string } | string;
export const FolderLike = z.custom<FolderLike>();

export type ChatState = Model["Chat"] & {
	messages: Pick<Model["Message"], "createdAt">[];
	folder: Pick<Model["Folder"], "settings"> | null;
	unseen: boolean;
};

export type ChatLike = { id: string } | string;
export const ChatLike = z.custom<ChatLike>();
