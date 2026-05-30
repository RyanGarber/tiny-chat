import type { MessageState } from '@tiny-chat/shared/src/types/chat.ts';
import { useEffect, useRef, useState } from 'react';
import { isTauri } from './api';

export const consumeLabel = {
  root: {
    position: 'relative',
  },
  input: {
    height: 54,
    paddingTop: 18,
  },
  label: {
    position: 'absolute',
    pointerEvents: 'none',
    fontSize: 'var(--mantine-font-size-xs)',
    paddingLeft: 'var(--mantine-spacing-sm)',
    paddingTop: 'calc(var(--mantine-spacing-sm) / 2)',
    zIndex: 1,
  },
} as never;

export async function openExternal(url: string) {
  console.log(`Opening link externally: ${url}`);

  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

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

export function isMissingToolResult(message: MessageState) {
  const parts = message.data.flat();
  const toolCallCount = parts.filter((p) => p.type === 'toolCall').length;
  const toolResultCount = parts.filter((p) => p.type === 'toolResult').length;
  return toolResultCount < toolCallCount;
}
