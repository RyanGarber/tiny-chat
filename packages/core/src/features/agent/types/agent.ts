import { zPlainDateTime } from "temporal-zod";
import z from "zod";
import { Enum } from "../../../core/services/PostgresService.ts";
import { zId } from "../../../core/types/common.ts";
import { zConfig } from "../../data/types/message.ts";
import { zData, zDataPart, zMetadata } from "../../data/types/part.ts";
import { zSettings, zUser } from "../../data/types/user.ts";

/**
 * The chat a generation belongs to. `id` is null while the chat is still a
 * draft — nothing has been saved, but the folder it is aimed at already decides
 * the settings, so an estimate can be built before the row exists.
 */
export const zAgentChat = z.object({
	id: zId.nullish(),
	folder: z.object({ settings: zSettings }).nullable(),
	incognito: z.boolean(),
	temporary: z.boolean(),
});
export type zAgentChat = z.infer<typeof zAgentChat>;

export const zAgentMessage = z.object({
	id: zId.nullable(),
	author: z.enum(Enum.Author.values),
	data: zData,
	config: zConfig.nullable(),
	createdAt: zPlainDateTime.nullable(),
});
export type zAgentMessage = z.infer<typeof zAgentMessage>;

export const zAgentContext = z.object({
	user: zUser,
	chat: zAgentChat.nullish(),
	messages: z.array(zAgentMessage),
	timezone: z.string(),
	interactive: z.boolean(),
});
export type zAgentContext = z.infer<typeof zAgentContext>;

export const zAgentEvent = z.discriminatedUnion("type", [
	z.object({ type: z.literal("start"), warnings: z.array(z.any()) }),
	z.object({ type: z.literal("data"), value: zDataPart }),
	z.object({ type: z.literal("end"), metadata: zMetadata }),
]);
export type zAgentEvent = z.infer<typeof zAgentEvent>;
