import { z } from "zod";
import type { FieldOutputTypes } from "../../../../generated/prisma/contract.d.ts";
import type { Model } from "../../../core/services/PostgresService.ts";

export type ProjectState = FieldOutputTypes["public"]["Project"] & {
	chats: ChatState[];
};

export type ProjectLike = { id: string } | string;
export const ProjectLike = z.custom<ProjectLike>();

export type ChatState = Model["Chat"] & {
	messages: Pick<Model["Message"], "createdAt">[];
	project: Pick<Model["Project"], "title" | "settings"> | null;
	unseen: boolean;
};

export type ChatLike = { id: string } | string;
export const ChatLike = z.custom<ChatLike>();
