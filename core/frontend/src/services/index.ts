import {GoogleAiStudioService} from "@/services/google-ai-studio";
import {DebugService} from "@/services/debug";
import {MessageUnomitted, zConfigType, zDataPartType, zMetadata} from "@tiny-chat/core-backend/types.ts";
import {z} from "zod";
import {MicrosoftFoundryService} from "@/services/microsoft-foundry";

export type ModelFeature = "generate" | "embed";

export interface Model {
    name: string;
    features: ModelFeature[];
}

export interface Service {
    name: string;
    apiKeyFormat: string;
    getModels: () => Promise<Model[]>;
    getArgs: (model: string) => ModelArg[] | null;
    generate: (
        instruction: string,
        context: MessageUnomitted[],
        config: zConfigType,
        abortSignal: AbortSignal
    ) => Stream;
    embed: (texts: string[], config: zConfigType) => Promise<number[][]>;
}

export const services: Service[] = [
    new DebugService(),
    new GoogleAiStudioService(),
    new MicrosoftFoundryService()
];

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
export type zSpecialPartType = z.infer<typeof zSpecialPart>;

export type Stream = AsyncGenerator<zDataPartType | zSpecialPartType>;