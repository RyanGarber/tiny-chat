import {z} from "zod";
import {type Message as PrismaMessage} from "./generated/prisma/client.ts";

export type ModelFeature = "generate" | "embed";

export type ModelArg = {
    type: "list";
    name: string;
    values: string[];
    default: string;
} | {
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

export interface Service {
    name: string;
    settings: string[];
    models: Model[];
}

export const zConfig = z.object({
    service: z.string(),
    model: z.string(),
    args: z.any().optional(),
    schema: z.any().optional(),
})

export type zConfig = z.infer<typeof zConfig>;

export const zDataPart =
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("thought"),
            value: z.string()
        }),
        z.object({
            type: z.literal("text"),
            value: z.string(),
            hidden: z.boolean().optional()
        }),
        z.object({
            type: z.literal("file"),
            name: z.string().optional(),
            mime: z.string().optional(),
            url: z.string(),
            inline: z.boolean().optional(),
        }),
        z.object({
            type: z.literal("toolCall"),
            id: z.string(),
            name: z.string(),
            args: z.any()
        }),
        z.object({
            type: z.literal("toolCallReturn"),
            id: z.string(),
            result: z.enum(["success", "failure"]),
            value: z.any()
        }),
        z.object({
            type: z.literal("abort"),
        }),
        z.object({
            type: z.literal("other"),
            value: z.any()
        })
    ]);

export type zDataPart = z.infer<typeof zDataPart>;

export const zData = z.array(zDataPart);

export type zData = z.infer<typeof zData>;

export const zMetadata = z.any();

export type zMetadata = z.infer<typeof zMetadata>;

// ── Stream / special part types ───────────────────────────────────

export const zSpecialPart = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("fileUpdate"),
        name: z.string(),
        url: z.string()
    }),
    z.object({
        type: z.literal("metadata"),
        value: zMetadata
    }),
]);
export type zSpecialPart = z.infer<typeof zSpecialPart>;

export type StreamPart = zDataPart | zSpecialPart;
export type Stream = AsyncGenerator<StreamPart>;

export type MessageUnomitted = PrismaMessage & {
    config: zConfig;
    data: zData;
    metadata: zMetadata;
    state: {
        any: boolean;
        thinking: boolean;
        generating: boolean;
    }
}

export type MessageOmission = {
    metadata: zMetadata
}

export type MessageOmitted = Omit<MessageUnomitted, "metadata">

export function wrapMessage(message: PrismaMessage): MessageOmitted {
    return {
        ...message,
        config: zConfig.parse(message.config),
        data: zData.parse(message.data),
        state: {
            any: false,
            thinking: false,
            generating: false,
        }
    }
}