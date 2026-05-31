import { ChatProvider } from '@tiny-chat/shared/src/providers/chat';
import { HuggingFaceProvider } from './huggingface';

export const frontendChatProviders: ChatProvider[] = [HuggingFaceProvider];
