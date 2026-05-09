import type { z } from 'zod';
import { type User } from '../server.ts';
import type { ContextItem, zGenerateInput } from '../types.ts';
import type { Chat } from '../../generated/prisma/client.ts';
import web from './web.ts';
import memory from './memory.ts';
import chat from './chat.ts';
import reply from './reply.ts';
import action from './action.ts';
import file from './file.ts';
import legiscan from './legiscan.ts';

export interface ToolContext {
  user: User;
  chat?: Chat;
  message: ContextItem;
  messages: ContextItem[];
  generateInput: zGenerateInput;
}

export interface ToolCall<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: ReturnType<z.ZodType['toJSONSchema']>;
  schema: T;

  needsUserInput?: boolean;
  run(context: ToolContext, params: z.infer<T>): Promise<unknown>;
}

export function tools(context: ToolContext) {
  console.log(
    'Tools:',
    context.generateInput.config.args?.tools === 'disabled' ? 'disabled' : 'enabled (default)',
  );
  if (context.generateInput.config.args?.tools === 'disabled') return [];
  return [
    ...reply(context),
    ...memory(context),
    ...action(context),
    ...web(context),
    ...file(context),
    ...chat(context),
    ...legiscan(context),
  ] as ToolCall[];
}
