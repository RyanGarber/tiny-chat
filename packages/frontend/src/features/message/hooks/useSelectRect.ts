import { RefObject, useEffect, useState } from 'react';

export function useSelectRect(_containerRef: RefObject<HTMLElement>, messageId: string) {
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const isInContainer = (node: Node | null) => {
      if (!node) return false;
      const el = node.nodeType === 3 ? node.parentElement : (node as Element);
      return !!el?.closest(`[data-message-id="${messageId}"]`);
    };

    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setRect((prev) => (prev !== null ? null : prev));
        return;
      }
      if (isInContainer(sel.anchorNode) && isInContainer(sel.focusNode)) {
        setRect(sel.getRangeAt(0).getBoundingClientRect());
      } else {
        setRect((prev) => (prev !== null ? null : prev));
      }
    };

    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [messageId]);

  return rect;
}
