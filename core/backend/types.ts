import {z} from "zod";
import {type Message as PrismaMessage} from "./generated/prisma/client.ts";

export const zAuthor = z.enum(["USER", "MODEL"]);

export type zAuthorType = z.infer<typeof zAuthor>;

export const zConfig = z.object({
    service: z.string(),
    model: z.string(),
    args: z.any().optional(),
})

export type zConfigType = z.infer<typeof zConfig>;

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
            name: z.string(),
            mime: z.string(),
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

export type zDataPartType = z.infer<typeof zDataPart>;

export const zData = z.array(zDataPart);

export type zDataType = z.infer<typeof zData>;

export const zMetadata = z.any();

export type zMetadataType = z.infer<typeof zMetadata>;

export type MessageUnomitted = PrismaMessage & {
    config: zConfigType;
    data: zDataType;
    metadata: zMetadataType;
    state: {
        any: boolean;
        thinking: boolean;
        generating: boolean;
    }
}

export type MessageOmission = {
    metadata: zMetadataType
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