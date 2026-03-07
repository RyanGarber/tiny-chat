import {z} from "zod";
import {type Message} from "./generated/prisma/client.ts";
import {Author} from "./generated/prisma/enums.ts";

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

export interface ChatProviderStatus {
    name: string;
    settings: string[];
    models: Model[];
}

export interface SearchProviderStatus {
    name: string;
    settings: string[];
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
            id: z.string().optional(),
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
            type: z.literal("toolResult"),
            id: z.string(),
            name: z.string(),
            value: z.any(),
            error: z.boolean().optional(),
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

export const zMetadata = z.array(z.any());

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

export const zGenerateInput = z.object({
    instruction: z.string(),
    context: z.array(z.object({id: z.cuid2().optional(), author: z.enum(Author), data: zData})),
    config: zConfig,
});
export type zGenerateInput = z.infer<typeof zGenerateInput>;

export const zGenerateOutput = z.discriminatedUnion("type", [
    z.object({type: z.literal("data"), value: zDataPart}),
    z.object({type: z.literal("special"), value: zSpecialPart}),
])
export type zGenerateOutput = z.infer<typeof zGenerateOutput>;

export type MessageUnomitted = Message & {
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

export function wrapMessage(message: Message): MessageOmitted {
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