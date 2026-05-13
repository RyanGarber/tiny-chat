import { memory } from './memory.ts';
import { legiscan } from './legiscan.ts';
import { chat } from './chat.ts';
import { action } from './action.ts';
import { upload } from './upload.ts';
import { web } from './web.ts';
import type { ToolGroup } from '@tiny-chat/shared/src/types/tool.ts';

export default [memory, action, upload, chat, web, legiscan] satisfies ToolGroup[];
