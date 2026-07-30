import z from "zod";
import type { Message } from "../../../../../server/generated/prisma/browser.ts";

export { Author } from "../../../../../server/generated/prisma/browser.ts";

// TODO
export const DEFAULT_TOOLSETS = [
	"questions",
	"actions",
	"memories",
	"web",
	"chat_shell",
];

export const DEFAULT_SKILLS: string[] = [];

export type MessageState = Message & {
	config: zConfig;
	data: zData;
	metadata: zMetadata;
	state: {
		any: boolean;
		thinking: boolean;
		generating: boolean;
	};
};

export type MessageSearchResult = Pick<
	MessageState,
	"id" | "chatId" | "author" | "data" | "createdAt"
> & { chatTitle: string | null };

export type MessageLike = { id: string } | string;
export const MessageLike = z.custom<MessageLike>();

export const zConfig = z.object({
	provider: z.string(),
	model: z.string(),
	args: z.any().default({}),
	schema: z.any().optional(), // z.custom<ZodStandardJSONSchemaPayload<any>>()
	toolsets: z.array(z.string()).default(DEFAULT_TOOLSETS),
	skills: z.array(z.string()).default(DEFAULT_SKILLS),
});
export type zConfig = z.infer<typeof zConfig>;

export const zToolDataPart = z.discriminatedUnion("type", [
	z.object({ type: z.literal("text"), value: z.string() }),
	z.object({
		type: z.literal("file"),
		name: z.string().optional(),
		mime: z.string(),
		data: z.base64(),
	}),
	z.object({ type: z.literal("json"), value: z.any() }),
]);
export type zToolDataPart = z.infer<typeof zToolDataPart>;

export const zToolData = z.array(zToolDataPart);
export type zToolData = z.infer<typeof zToolData>;

export const zSignature = z.object({
	model: z.string().optional(),
	item: z.string().optional(),
	reasoning: z.string().optional(),
});
export type zSignature = z.infer<typeof zSignature>;

export const zDataPart = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("thought"),
		id: z.string().optional(),
		value: z.string(),
		signature: zSignature.optional(),
	}),
	z.object({
		type: z.literal("text"),
		id: z.string().optional(),
		value: z.string(),
		signature: zSignature.optional(),
	}),
	z.object({
		type: z.literal("json"),
		id: z.string().optional(),
		value: z.any(),
		signature: zSignature.optional(),
	}),
	z.object({
		type: z.literal("toolCall"),
		id: z.string(),
		name: z.string(),
		args: z.any(),
		signature: zSignature.optional(),
	}),
	z.object({
		type: z.literal("toolResult"),
		id: z.string(),
		name: z.string(),
		value: z
			.array(zToolDataPart)
			.catch(({ value }) => [{ type: "json", value: value }]),
		error: z.boolean().optional(),
	}),
	z.object({
		type: z.literal("file"),
		id: z.string().optional(),
		name: z.string().optional(),
		mime: z.string(),
		data: z.base64(),
		signature: zSignature.optional(),
	}),
	z.object({
		type: z.literal("upload"),
		id: z.cuid2(),
		name: z.string(),
		thumbnail: z.string().optional(),
	}),
	z.object({
		type: z.literal("abort"),
		reason: z.enum(["user", "content", "length", "error", "other"]),
		message: z.string().optional(),
		details: z.any().optional(),
	}),
]);
export type zDataPart = z.infer<typeof zDataPart>;

export const zData = z.array(z.array(zDataPart));
export type zData = z.infer<typeof zData>;

export const zMetadata = z.array(z.any());
export type zMetadata = z.infer<typeof zMetadata>;
