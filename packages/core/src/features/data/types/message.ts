import z from "zod";
import type { Model } from "../../../core/services/PostgresService.ts";
import type { zData, zMetadata } from "./part.ts";

export const DEFAULT_TOOLSETS = [
	"questions",
	"actions",
	"memories",
	"web",
	"subagents",
	"shell",
];

export const DEFAULT_SKILLS: string[] = [];

export type MessageState = Omit<Model["Message"], "embedding"> & {
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
