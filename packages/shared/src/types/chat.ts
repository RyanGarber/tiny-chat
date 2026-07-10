import { type JSONType, z } from "zod";
import type {
	Chat,
	Message,
} from "../../../backend/generated/prisma/client.ts";
import {
	Author,
	MemoryCategory,
	MemoryStability,
	UploadType,
} from "../../../backend/generated/prisma/enums.ts";

export { Author, type Chat, MemoryCategory, MemoryStability };

export const DEFAULT_TOOL_GROUPS = [
	"questions",
	"actions",
	"memories",
	"web",
	"chat",
];

export const DEFAULT_SKILLS: string[] = [];

export const zConfig = z.object({
	provider: z.string(),
	model: z.string(),
	args: z.any().optional(),
	schema: z.any().optional(),
	toolGroups: z.array(z.string()).default(DEFAULT_TOOL_GROUPS),
	skills: z.array(z.string()).default(DEFAULT_SKILLS),
});
export type zConfig = z.infer<typeof zConfig>;

export const zSignature = z.object({
	model: z.string().optional(),
	item: z.string().optional(),
	reasoning: z.string().optional(),
});
export type zSignature = z.infer<typeof zSignature>;

export const zToolResultValue = z.array(
	z.discriminatedUnion("type", [
		z.object({ type: z.literal("text"), value: z.string() }),
		z.object({
			type: z.literal("file"),
			name: z.string().optional(),
			mime: z.string(),
			data: z.base64(),
		}),
		z.object({ type: z.literal("json"), value: z.json() }),
	]),
);
export type zToolResultValue = z.infer<typeof zToolResultValue>;

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
		value: z.json(),
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
		value: zToolResultValue.catch(({ value }) => [
			{ type: "json", value: value as JSONType },
		]),
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

export const zChat = z.object({
	id: z.cuid2(), // TODO - fix security issue
	userId: z.string(),
	folderId: z.cuid2(),
	incognito: z.boolean(),
});
export type zChat = z.infer<typeof zChat>;

export const zContextItem = z.object({
	id: z.cuid2().nullable(),
	author: z.enum(Author),
	data: zData,
	config: zConfig.nullable(),
	createdAt: z.date().nullable(),
});
export type zContextItem = z.infer<typeof zContextItem>;

export const zGenerateInput = z.object({
	context: z.array(zContextItem),
	config: zConfig,
	timezone: z.string(),
	incognito: z.boolean(),
	supportsUserInput: z.boolean(),
	overrideInstructions: z.string().optional(),
});
export type zGenerateInput = z.infer<typeof zGenerateInput>;

export const zGenerateOutput = z.discriminatedUnion("type", [
	z.object({ type: z.literal("start"), warnings: z.array(z.any()) }),
	z.object({ type: z.literal("data"), value: zDataPart }),
	z.object({ type: z.literal("end"), metadata: zMetadata }),
]);
export type zGenerateOutput = z.infer<typeof zGenerateOutput>;

export const zUploadOutput = z.custom<Extract<zDataPart, { type: "upload" }>>();
export type zUploadOutput = z.infer<typeof zUploadOutput>;

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

export type ModelFeature = "generate" | "embed" | "toolCall";

export type ModelArg =
	| {
			type: "list";
			name: string;
			values: string[];
			default: string;
	  }
	| {
			type: "range";
			name: string;
			min: number;
			max: number;
			step: number;
			default: number;
	  };

export interface Model {
	name: string;
	features: ModelFeature[];
	args: ModelArg[];
}

export interface ChatSearchResult {
	id: string;
	chatId: string;
	author: string;
	data: zData;
	createdAt: Date;
	chatTitle: string | null;
}

export interface MemorySearchResult {
	id: string;
	fact: string;
	category: MemoryCategory;
	stability: MemoryStability;
	createdAt: Date;
}

export { UploadType };

export interface FileSearchResult {
	id: string;
	chatId: string | null;
	uploadId: string | null;
	path: string[];
	data: Uint8Array;
}
