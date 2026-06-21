import { z } from 'zod';
import { zUser } from './user.ts';
import type { zToolResultValue } from './chat.ts';
import { zChat, zGenerateInput } from './chat.ts';
import { zSkill } from './skill.ts';
import type { GenerationCallbacks } from '../services/chat/generate.ts';

export const zToolContext = z.object({
  user: zUser,
  chat: zChat.nullable(),
  generation: zGenerateInput,
  skills: z.array(zSkill),
});
export type zToolContext = z.infer<typeof zToolContext>;

export interface ToolContext extends zToolContext {
  callbacks: GenerationCallbacks;
}

export const zTool = z.object({
  name: z.string(),
  description: z.string(),
  input: z.any(),
  userInput: z.any().optional(),
  output: z.any(),
  overrides: z.boolean().optional(),

  requirements: z
    .object({
      chat: z.boolean().optional(),
      notIncognito: z.boolean().optional(),
      embeddings: z.boolean().optional(),
      approval: z.boolean().optional(),
      provider: z.array(z.string()).optional(),
      desktop: z.boolean().optional(),
    })
    .optional(),
});

export type zTool = z.infer<typeof zTool>;

export interface Tool<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
  TUserInput extends z.ZodTypeAny | undefined = undefined,
> extends zTool {
  run(
    context: ToolContext,
    input: z.infer<TInput>,
    userInput: z.infer<TUserInput>,
  ): Promise<
    (
      | NonNullable<Exclude<ReturnType<zToolResultValue['at']>, { type: 'json' }>>
      | { type: 'json'; value: z.infer<TOutput> }
    )[]
  >;
}

export const zToolGroup = z.object({
  name: z.string(),
  tools: z.array(zTool),
  instructions: z
    .object({
      heading: z.string(),
      body: z.string(),
    })
    .optional(),
});
export type zToolGroup = z.infer<typeof zToolGroup>;

export interface ToolGroup extends zToolGroup {
  tools: Tool<any, any, any>[];
}
