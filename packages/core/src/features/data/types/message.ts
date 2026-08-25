import z from "zod";
import type { Message } from "../../../../../server/generated/prisma/browser.ts";

export { Author } from "../../../../../server/generated/prisma/browser.ts";

export const DEFAULT_TOOLSETS = [
	"questions",
	"actions",
	"memories",
	"web",
	"subagents",
	"shell",
];

export const DEFAULT_SKILLS: string[] = [];

export type MessageState = Message & {
	config: zConfig;
	data: zData;
	metadata: zMetadata;
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
	schema: z.any().nullish(), // z.custom<ZodStandardJSONSchemaPayload<any>>()
	args: z
		.any()
		.nullish()
		.transform((args) => args ?? {}),
	toolsets: z
		.array(z.string())
		.nullish()
		.transform((toolsets) => toolsets ?? DEFAULT_TOOLSETS),
	skills: z
		.array(z.string())
		.nullish()
		.transform((skills) => skills ?? DEFAULT_SKILLS),
});
export type zConfig = z.infer<typeof zConfig>;

export const zSignature = z.object({
	model: z.string().optional(),
	item: z.string().optional(),
	reasoning: z.string().optional(),
});
export type zSignature = z.infer<typeof zSignature>;

export const zToolValidation = z.object({
	approval: z.boolean().optional(),
});
export type zToolValidation = z.infer<typeof zToolValidation>;

export type zDataPart =
	| { type: "thought"; id?: string; value: string; signature?: zSignature }
	| { type: "text"; id?: string; value: string; signature?: zSignature }
	| { type: "json"; id?: string; value: any; signature?: zSignature }
	| {
			type: "file";
			id?: string;
			name?: string;
			mime: string;
			data: string;
			signature?: zSignature;
	  }
	| {
			type: "toolCall";
			id: string;
			name: string;
			args: any;
			signature?: zSignature;
			validation?: zToolValidation;
	  }
	| {
			type: "toolResult";
			id: string;
			name: string;
			value: zDataBasicPart[];
			append?: zDataBasicPart[];
			error?: boolean;
	  }
	| {
			type: "abort";
			reason: "user" | "content" | "length" | "error" | "other";
			message?: string;
			details?: any;
	  };

export type zDataBasicPart = Extract<
	zDataPart,
	{ type: "text" | "json" | "file" }
>;

export const zDataPart: z.ZodType<zDataPart> = z.discriminatedUnion("type", [
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
		type: z.literal("file"),
		id: z.string().optional(),
		name: z.string().optional(),
		mime: z.string(),
		data: z.base64(),
		signature: zSignature.optional(),
	}),
	z.object({
		type: z.literal("toolCall"),
		id: z.string(),
		name: z.string(),
		args: z.any(),
		signature: zSignature.optional(),
		validation: zToolValidation.optional(),
	}),
	z.object({
		type: z.literal("toolResult"),
		id: z.string(),
		name: z.string(),
		value: z
			.lazy(() => zDataBasicPart.array())
			.catch(({ value }) => [{ type: "json", value: value }]),
		append: z.lazy(() => zDataBasicPart.array()).optional(),
		error: z.boolean().optional(),
	}),
	z.object({
		type: z.literal("abort"),
		reason: z.enum(["user", "content", "length", "error", "other"]),
		message: z.string().optional(),
		details: z.any().optional(),
	}),
]);

export const zDataBasicPart = zDataPart.refine(
	(part) =>
		part.type === "text" || part.type === "json" || part.type === "file",
);

export const zData = z.array(z.array(zDataPart));
export type zData = z.infer<typeof zData>;

export const zMetadata = z.array(z.any());
export type zMetadata = z.infer<typeof zMetadata>;
