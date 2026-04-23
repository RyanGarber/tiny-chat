import { Debug } from './debug.ts';
import { wrap } from './ai-sdk/index.ts';
import { GoogleProvider } from './ai-sdk/google.ts';
import { AnthropicProvider } from './ai-sdk/anthropic.ts';
import { OpenAIProvider } from './ai-sdk/openai.ts';
import { AzureProvider } from './ai-sdk/azure.ts';
import type { ContextItem, Model, zConfig, zGenerateOutput } from '../../types.ts';
import type { ToolCall } from '../../tools/index.ts';
import { type User } from '../../server.ts';
import { AWSProvider } from './ai-sdk/aws.ts';
import type { BaseProvider } from '../base.ts';

export interface ChatProvider extends BaseProvider {
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

export const chatProviders: ChatProvider[] = [
  Debug,
  wrap(GoogleProvider),
  wrap(AnthropicProvider),
  wrap(OpenAIProvider),
  wrap(AzureProvider),
  wrap(AWSProvider),
];
