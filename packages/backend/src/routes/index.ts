import folders from './folders.ts';
import chats from './chats.ts';
import embeddings from './embeddings.ts';
import messages from './messages.ts';
import sessions from './sessions.ts';
import persistence from './persistence.ts';
import github from './github.ts';
import capabilities from './capabilities.ts';
import settings from './settings.ts';
import { router } from '../index.ts';

export const tRPCRouter = router({
  folders,
  chats,
  embeddings,
  messages,
  sessions,
  persistence,
  github,
  capabilities,
  settings,
});

export type tRPCRouter = typeof tRPCRouter;
