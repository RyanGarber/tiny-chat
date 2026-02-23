import {GoogleAiStudioService} from "@/services/google-ai-studio";
import {DebugService} from "@/services/debug";
import {MessageUnomitted, zConfigType, zDataPartType, zMetadata} from "@tiny-chat/core-backend/types.ts";
import {z} from "zod";
import {MicrosoftFoundryService} from "@/services/microsoft-foundry";

export interface Service {
    name: string;
    apiKeyFormat: string;
    getModels: () => Promise<string[]>;
    getArgs: (model: string) => ModelArg[] | null;
    callModel: (
        instruction: string,
        context: MessageUnomitted[],
        config: zConfigType,
    ) => Stream;
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

export const StreamEnd = z.object({metadata: zMetadata});
export type StreamEndType = z.infer<typeof StreamEnd>;

export type Stream = AsyncGenerator<zDataPartType | StreamEndType>;