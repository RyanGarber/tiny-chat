import { useState, useRef, useEffect } from 'react';

export interface StreamedLengthResult {
  displayedLength: number;
  /** How many characters were added in the most recent animation frame. */
  newCharsCount: number;
}

export function useStreamedLength(
  fullLength: number,
  isGenerating: boolean,
): StreamedLengthResult {
  const [state, setState] = useState<StreamedLengthResult>({
    displayedLength: fullLength,
    newCharsCount: 0,
  });

  const fullLengthRef = useRef(fullLength);
  const displayedLengthRef = useRef(fullLength);
  const frameRef = useRef<number | null>(null);
  const isGeneratingRef = useRef(isGenerating);
  const tickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fullLengthRef.current = fullLength;
    if (isGeneratingRef.current && frameRef.current === null && tickRef.current) {
      frameRef.current = requestAnimationFrame(tickRef.current);
    }
  }, [fullLength]);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;

    if (!isGenerating) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      setState({ displayedLength: fullLengthRef.current, newCharsCount: 0 });
      displayedLengthRef.current = fullLengthRef.current;
      tickRef.current = null;
      return;
    }

    const CHARS_PER_FRAME = 4;
    const CATCHUP_THRESHOLD = 40;

    const tick = () => {
      const pending = fullLengthRef.current - displayedLengthRef.current;
      if (pending > 0) {
        const charsToAdd =
          pending > CATCHUP_THRESHOLD ? Math.ceil(pending / 2) : Math.min(CHARS_PER_FRAME, pending);
        const next = Math.min(displayedLengthRef.current + charsToAdd, fullLengthRef.current);
        const added = next - displayedLengthRef.current;
        displayedLengthRef.current = next;
        setState({ displayedLength: next, newCharsCount: added });
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null; // pause until new text arrives
      }
    };

    tickRef.current = tick;
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isGenerating]);

  if (!isGenerating) return { displayedLength: fullLength, newCharsCount: 0 };
  return state;
}
