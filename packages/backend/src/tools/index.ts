import type { ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import { web } from './web.ts';
import { memories } from './memories.ts';
import { actions } from './actions.ts';
import { uploads } from './uploads.ts';
import { legiscan } from './legiscan.ts';
import { chats } from './chats.ts';

export default [chats, web, memories, actions, uploads, legiscan] satisfies ToolGroup[];
