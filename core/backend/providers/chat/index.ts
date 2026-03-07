import {Debug} from "./debug.ts";
import {GoogleAIStudio} from "./google-ai-studio.ts";
import {MicrosoftFoundry} from "./microsoft-foundry.ts";
import {AnthropicAI} from "./anthropic-ai.ts";
import type {MessageUnomitted, Model, zConfig, zGenerateOutput} from "../../types.ts";
import type {CustomTool} from "../../tools/index.ts";
import {type Session} from "../../server.ts";

export class SettingsError extends Error {
}

export interface ChatProvider {
    name: string;
    settings: string[];
    getModels: (session: Session) => Promise<Model[]>;
    generate: (
        session: Session,
        instruction: string,
        context: MessageUnomitted[],
        config: zConfig,
        abortSignal: AbortSignal,
        tools: CustomTool[],
    ) => AsyncGenerator<zGenerateOutput>;
    embed: (session: Session, texts: string[], config: zConfig) => Promise<number[][]>;
}

export const chatProviders: ChatProvider[] = [
    Debug,
    GoogleAIStudio,
    MicrosoftFoundry,
    AnthropicAI,
];