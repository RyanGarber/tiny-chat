import {Debug} from "./debug.ts";
import {GoogleAiStudio} from "./google-ai-studio.ts";
import {MicrosoftFoundry} from "./microsoft-foundry.ts";
import {AnthropicAi} from "./anthropic-ai.ts";
import type {MessageUnomitted, Model, Stream, zConfig} from "../types.ts";

export class SettingsError extends Error {
}

export interface ServiceRunner {
    name: string;
    settings: string[];
    getModels: (settings: any) => Promise<Model[]>;
    generate: (
        settings: any,
        instruction: string,
        context: MessageUnomitted[],
        config: zConfig,
        abortSignal: AbortSignal
    ) => Stream;
    embed: (settings: any, texts: string[], config: zConfig) => Promise<number[][]>;
}

export const services: ServiceRunner[] = [
    new Debug(),
    new GoogleAiStudio(),
    new AnthropicAi(),
    new MicrosoftFoundry(),
];