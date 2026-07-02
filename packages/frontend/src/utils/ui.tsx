import { useEffect, useRef, useState } from 'react';
import { Author } from '@tiny-chat/backend/generated/prisma/enums.ts';
import { zConfig } from '@tiny-chat/shared/src/types/chat.ts';
import { trpc } from '@/utils/api.ts';

export function useViewport() {
  const [height, setHeight] = useState(window.visualViewport?.height ?? window.innerHeight);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let frameId: number;

    const onUpdate = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        setHeight(vv.height);
        if (containerRef.current)
          containerRef.current.style.transform = `translateY(${vv.offsetTop}px)`;
      });
    };

    // Immediately set initial values
    onUpdate();

    vv.addEventListener('resize', onUpdate);
    vv.addEventListener('scroll', onUpdate);
    return () => {
      cancelAnimationFrame(frameId);
      vv.removeEventListener('resize', onUpdate);
      vv.removeEventListener('scroll', onUpdate);
    };
  }, []);

  return { height, containerRef };
}

export async function importChat(
  messages: { author: Author; reasoning?: string | undefined; text?: string | undefined }[],
  config: zConfig,
) {
  let chatId: string | undefined = undefined;
  for (const message of messages) {
    const created = await trpc.message.create.mutate({
      chatId,
      config,
      author: message.author,
      data: [
        [
          ...(message.reasoning?.length
            ? [{ type: 'thought' as const, value: message.reasoning }]
            : []),
          ...(message.text?.length ? [{ type: 'text' as const, value: message.text }] : []),
        ],
      ],
      metadata: [],
    });
    console.log(`created ${created.id} in chat ${chatId}`);
    chatId ??= created.chatId;
  }
}
