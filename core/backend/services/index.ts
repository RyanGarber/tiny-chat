import {Debug} from "./debug.ts";
import {GoogleAIStudio} from "./google-ai-studio.ts";
import {MicrosoftFoundry} from "./microsoft-foundry.ts";
import {AnthropicAI} from "./anthropic-ai.ts";
import type {MessageUnomitted, Model, zConfig, zGenerateOutput} from "../types.ts";
import type {ToolRunner} from "../tools/index.ts";
import {type Session} from "../server.ts";

export class SettingsError extends Error {
}

export interface ServiceRunner {
    name: string;
    settings: string[];
    getModels: (session: Session) => Promise<Model[]>;
    generate: (
        session: Session,
        instruction: string,
        context: MessageUnomitted[],
        config: zConfig,
        abortSignal: AbortSignal,
        tools: ToolRunner[],
    ) => AsyncGenerator<zGenerateOutput>;
    embed: (session: Session, texts: string[], config: zConfig) => Promise<number[][]>;
}

export const services: ServiceRunner[] = [
    Debug,
    GoogleAIStudio,
    MicrosoftFoundry,
    AnthropicAI,
];