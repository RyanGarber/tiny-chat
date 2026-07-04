import type { ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { web } from './web.ts';
import { memories } from './memories.ts';
import { actions } from './actions.ts';
import { chat } from './chat.ts';
import { legiscan } from './legiscan.ts';

export default [web, memories, actions, chat, legiscan] satisfies ToolGroup[];
