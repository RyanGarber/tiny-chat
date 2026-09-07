import { z } from "zod";

export const zSignature = z.object({
	model: z.string().optional(),
	item: z.string().optional(),
	reasoning: z.string().optional(),
});
export type zSignature = z.infer<typeof zSignature>;

const _zDataPart = z.object({
	id: z.string(),
	signature: zSignature.optional(),
});

export const zTextPart = _zDataPart.extend({
	type: z.literal("text"),
	value: z.string(),
});
export type zTextPart = z.infer<typeof zTextPart>;

export const zThoughtPart = _zDataPart.extend({
	type: z.literal("thought"),
	value: z.string(),
});
export type zThoughtPart = z.infer<typeof zThoughtPart>;

export const zFilePart = _zDataPart.extend({
	type: z.literal("file"),
	name: z.string().optional(),
	mime: z.string(),
	data: z.base64(),
});
export type zFilePart = z.infer<typeof zFilePart>;

export const zJsonPart = _zDataPart.extend({
	type: z.literal("json"),
	value: z.any(),
});
export type zJsonPart = z.infer<typeof zJsonPart>;

export const zDirectoryPart = _zDataPart.extend({
	type: z.literal("directory"),
	items: z.array(
		z.object({ path: z.string(), directory: z.boolean().optional() }),
	),
});
export type zDirectoryPart = z.infer<typeof zDirectoryPart>;

export const zWebPart = _zDataPart.extend({
	type: z.literal("web"),
	title: z.string().optional(),
	url: z.string(),
	content: z.string(),
});
export type zWebPart = z.infer<typeof zWebPart>;

export const zToolCallPart = _zDataPart.extend({
	type: z.literal("toolCall"),
	name: z.string(),
	input: z.any(),
	validation: z
		.object({
			approval: z.boolean(),
		})
		.partial()
		.optional(),
});
export type zToolCallPart = z.infer<typeof zToolCallPart>;

export const zToolResultPart = _zDataPart.extend({
	type: z.literal("toolResult"),
	name: z.string(),
	get output() {
		return zDataSimplePart.array();
	},
	error: z.boolean().optional(),
});
export type zToolResultPart = z.infer<typeof zToolResultPart>;

export const zAbortPart = _zDataPart.extend({
	type: z.literal("abort"),
	reason: z.enum(["user", "content", "length", "error", "other"]),
	message: z.string().optional(),
	details: z.any().optional(),
});
export type zAbortPart = z.infer<typeof zAbortPart>;

export const zAttachmentPart = _zDataPart.extend({
	type: z.literal("attachment"),
	source: z.string(),
	label: z.string(),
	content: z.discriminatedUnion("type", [
		zFilePart.omit({ id: true }),
		zDirectoryPart.omit({ id: true }),
		zWebPart.omit({ id: true, url: true }),
		z.object({ type: z.literal("unavailable") }),
	]),
});
export type zAttachmentPart = z.infer<typeof zAttachmentPart>;

export const zInterjectionPart = _zDataPart.extend({
	type: z.literal("interjection"),
	get value() {
		return z.array(zDataSimplePart);
	},
});
export type zInterjectionPart = z.infer<typeof zInterjectionPart>;

export const zDataPart = z.discriminatedUnion("type", [
	zTextPart,
	zThoughtPart,
	zJsonPart,
	zFilePart,
	zAttachmentPart,
	zToolCallPart,
	zToolResultPart,
	zAbortPart,
	zInterjectionPart,
]);
export type zDataPart = z.infer<typeof zDataPart>;

export const zDataSimplePart = z.discriminatedUnion("type", [
	zTextPart,
	zJsonPart,
	zFilePart,
	zAttachmentPart,
]);
export type zDataSimplePart = z.infer<typeof zDataSimplePart>;

export const zData = z.array(z.array(zDataPart));
export type zData = z.infer<typeof zData>;

export const zMetadata = z.array(z.any());
export type zMetadata = z.infer<typeof zMetadata>;
