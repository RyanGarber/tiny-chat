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

export type zDataPart = { id: string; signature?: zSignature } & (
	| { type: "thought"; value: string }
	| { type: "text"; value: string }
	| { type: "json"; value: any }
	| {
			type: "file";
			name?: string;
			mime: string;
			data: string;
	  }
	| {
			type: "toolCall";
			name: string;
			input: any;
			validation?: zToolValidation;
	  }
	| {
			type: "toolResult";
			name: string;
			output: zDataBasicPart[];
			append?: zDataBasicPart[];
			error?: boolean;
	  }
	| {
			type: "abort";
			reason: "user" | "content" | "length" | "error" | "other";
			message?: string;
			details?: any;
	  }
	| {
			type: "attachment";
			source: string;
			label: string;
			content:
				| { type: "file"; mime?: string; data: string }
				| { type: "directory"; items: { path: string; directory?: boolean }[] }
				| { type: "web"; title?: string; content: string }
				| { type: "unavailable" };
	  }
);

export type zDataBasicPart = Extract<
	zDataPart,
	{ type: "text" | "json" | "file" }
>;

const zDataPartBase = {
	id: z.string(),
	signature: zSignature.optional(),
};

export const zDataPart: z.ZodType<zDataPart> = z.discriminatedUnion("type", [
	z.object({
		...zDataPartBase,
		type: z.literal("thought"),
		value: z.string(),
	}),
	z.object({
		...zDataPartBase,
		type: z.literal("text"),
		value: z.string(),
	}),
	z.object({
		...zDataPartBase,
		type: z.literal("json"),
		value: z.any(),
	}),
	z.object({
		...zDataPartBase,
		type: z.literal("file"),
		name: z.string().optional(),
		mime: z.string(),
		data: z.base64(),
	}),
	z.object({
		...zDataPartBase,
		type: z.literal("toolCall"),
		name: z.string(),
		input: z.any(),
		validation: zToolValidation.optional(),
	}),
	z.object({
		...zDataPartBase,
		type: z.literal("toolResult"),
		name: z.string(),
		output: z.lazy(() => zDataBasicPart.array()),
		append: z.lazy(() => zDataBasicPart.array()).optional(),
		error: z.boolean().optional(),
	}),
	z.object({
		...zDataPartBase,
		type: z.literal("abort"),
		reason: z.enum(["user", "content", "length", "error", "other"]),
		message: z.string().optional(),
		details: z.any().optional(),
	}),
	z.object({
		...zDataPartBase,
		type: z.literal("attachment"),
		source: z.string(),
		label: z.string(),
		content: z.discriminatedUnion("type", [
			z.object({
				type: z.literal("file"),
				mime: z.string().optional(),
				data: z.base64(),
			}),
			z.object({
				type: z.literal("directory"),
				items: z.array(
					z.object({ path: z.string(), directory: z.boolean().optional() }),
				),
			}),
			z.object({
				type: z.literal("web"),
				title: z.string().optional(),
				content: z.string(),
			}),
			z.object({ type: z.literal("unavailable") }),
		]),
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
