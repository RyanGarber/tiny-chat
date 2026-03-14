import { Debug } from './debug.ts';
import { GoogleAIStudio } from './google-ai-studio.ts';
import { MicrosoftFoundry } from './microsoft-foundry.ts';
import { AnthropicAI } from './anthropic-ai.ts';
import type { ContextItem, Model, zConfig, zGenerateOutput } from '../../types.ts';
import type { ToolCall } from '../../tools/index.ts';
import { type User } from '../../server.ts';

export class SettingsError extends Error {}

export interface ChatProvider {
  name: string;
  settings: string[];
  getModels: (user: User) => Promise<Model[]>;
  generate: (
    user: User,
    instructions: string,
    context: ContextItem[],
    config: zConfig,
    abortSignal: AbortSignal,
    tools: ToolCall[],
  ) => AsyncGenerator<zGenerateOutput>;
  embed: (user: User, texts: string[], config: zConfig) => Promise<number[][]>;
}

export const chatProviders: ChatProvider[] = [Debug, GoogleAIStudio, MicrosoftFoundry, AnthropicAI];
