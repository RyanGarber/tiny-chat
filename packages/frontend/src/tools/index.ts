import { filesystem } from './filesystem.ts';
import { shell } from './shell.ts';
import { reply } from './reply.ts';
import type { ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { skills } from './skills.ts';

export default [filesystem, shell, reply, skills] satisfies ToolGroup[];
