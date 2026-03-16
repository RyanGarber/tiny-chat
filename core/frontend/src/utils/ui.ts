import { notifications } from '@mantine/notifications';
import { useEffect, useRef, useState } from 'react';

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

export function alert(type: 'info' | 'warning' | 'error', message: string) {
  const color = type === 'error' ? 'red' : type === 'warning' ? 'yellow' : undefined;
  notifications.show({ message, color });
}

export async function openExternal(url: string) {
  console.log(`Opening link externally: ${url}`);

  if ('__TAURI__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }

  // Normal browser
  window.open(url, '_blank', 'noopener,noreferrer');
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
