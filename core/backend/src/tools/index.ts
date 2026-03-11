import type { z } from 'zod';
import { type Session } from '../server.ts';
import type { MessageUnomitted } from '../types.ts';
import web from './web.ts';
import memory from './memory.ts';

export interface CustomTool<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: ReturnType<z.ZodType['toJSONSchema']>;
  schema: T;

  run({
    session,
    message,
    params,
  }: {
    session: Session;
    message: MessageUnomitted;
    params: z.infer<T>;
  }): Promise<unknown>;
}

export function tools(session: Session) {
  return [...web(session), ...memory(session)] as CustomTool[];
}
