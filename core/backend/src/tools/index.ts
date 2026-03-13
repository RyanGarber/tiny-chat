import type { z } from 'zod';
import { type Session } from '../server.ts';
import type { MessageUnomitted, zGenerateInput } from '../types.ts';
import type { Chat } from '../../generated/prisma/client.ts';
import web from './web.ts';
import memory from './memory.ts';
import chat from './chat.ts';
import user from './user.ts';
import action from './action.ts';

export interface ToolContext {
  session: Session;
  message: MessageUnomitted;
  chat?: Chat;
  input: zGenerateInput;
}

export interface CustomTool<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: ReturnType<z.ZodType['toJSONSchema']>;
  schema: T;

  needsUserInput?: boolean;
  run(context: ToolContext, params: z.infer<T>): Promise<unknown>;
}

export function tools(context: ToolContext) {
  return [
    ...web(context),
    ...memory(context),
    ...chat(context),
    ...user(context),
    ...action(context),
  ] as CustomTool[];
}
