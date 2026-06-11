import { useMutation } from '@tanstack/react-query';
import { GenerateService, getGenerationCallbacks } from '../services/GenerateService';
import type { MessageState, zDataPart } from '@tiny-chat/shared/src/types/chat';
import { useChat } from '@/features/chat/hooks/useChat';
import { useProviders } from '@/features/input/hooks/useProviders';
import { useSkills } from '@/features/input/hooks/useSkills';
import { useTools } from '@/features/input/hooks/useTools';
import { auth, trpc } from '@/utils/api';
import type { ToolContext } from '@tiny-chat/shared/src/types/tool';

export const toolCallRejectedMessage = 'User rejected the tool call.';
export const toolInputMutationKey = ['toolInput'] as const;

export const useToolInput = () => {
  const { providers } = useProviders();
  const { skills } = useSkills();
  const { toolGroups, tools } = useTools();
  const { chat } = useChat();
  const session = auth.useSession();

  const sendToolInput = useMutation({
    mutationKey: toolInputMutationKey,
    mutationFn: async ({
      seed,
      part,
      value,
      approved,
    }: {
      seed: MessageState;
      part: Extract<zDataPart, { type: 'toolCall' }>;
      value?: unknown;
      approved?: boolean;
    }) => {
      console.log('[ToolInput] sending tool input', seed, part, value, approved);
      const messages = await trpc.message.list.query({ chatId: chat.data!.id });
      const context: ToolContext = {
        user: session.data!.user,
        chat: chat.data!,
        generation: {
          context: messages,
          config: seed.config,
          incognito: chat.data!.incognito,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          supportsUserInput: true,
        },
        skills,
        callbacks: getGenerationCallbacks(session.data!.user),
      };

      const tool = tools.find((t) => t.name === part.name);
      if (!tool) throw new Error(`Tool ${part.name} not found`);

      let result: zDataPart;
      if (tool.requirements?.approval && !approved) {
        result = {
          type: 'toolResult',
          id: part.id,
          name: part.name,
          error: true,
          value: toolCallRejectedMessage,
        };
      } else {
        try {
          const output = (await tool.run(context, part.args, value)) as unknown;
          result = {
            type: 'toolResult',
            id: part.id,
            name: part.name,
            error: false,
            value: output,
          };
        } catch (e) {
          result = {
            type: 'toolResult',
            id: part.id,
            name: part.name,
            error: true,
            value: e instanceof Error ? e.message : JSON.stringify(e),
          };
        }
      }

      await GenerateService.handle({
        message: seed,
        activeChat: chat.data!,
        append: [result],
        tools: toolGroups,
        providers: providers.data!,
        skills,
      });
    },
  });

  return { sendToolInput };
};
