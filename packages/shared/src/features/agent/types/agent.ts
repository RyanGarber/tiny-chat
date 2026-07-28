import z from "zod";
import { zChat } from "../../data/types/chat.ts";
import {
	Author,
	zConfig,
	zData,
	zDataPart,
	zMetadata,
} from "../../data/types/message.ts";
import { zUser } from "../../data/types/user.ts";

export const zAgentMessage = z.object({
	id: z.cuid2().nullable(),
	author: z.enum(Author),
	data: zData,
	config: zConfig.nullable(),
	createdAt: z.date().nullable(),
});
export type zAgentMessage = z.infer<typeof zAgentMessage>;

export const zAgentContext = z.object({
	user: zUser,
	chat: zChat.nullish(),
	messages: z.array(zAgentMessage),
	timezone: z.string(),
	supportsUserInput: z.boolean(),
	overrideInstructions: z.string().optional(),
});
export type zAgentContext = z.infer<typeof zAgentContext>;

export const zAgentEvent = z.discriminatedUnion("type", [
	z.object({ type: z.literal("start"), warnings: z.array(z.any()) }),
	z.object({ type: z.literal("data"), value: zDataPart }),
	z.object({ type: z.literal("end"), metadata: zMetadata }),
]);
export type zAgentEvent = z.infer<typeof zAgentEvent>;
