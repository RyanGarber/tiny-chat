import { ChatProvider } from '@tiny-chat/shared/src/providers/chat';
import { WebLLMProvider } from './webllm';

export const frontendChatProviders: ChatProvider[] = [WebLLMProvider];
