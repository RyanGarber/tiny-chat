import {
  ComponentType,
  type CSSProperties,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AnimateOptions, ExtraProps, StreamdownContext } from 'streamdown';
import { CODE_MARKER } from '@/utils/data.ts';

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

export const STREAMDOWN_WORD_INDEX = 'data-sd-word-index';
export const STREAMDOWN_BLUR_OPTIONS: AnimateOptions = {
  animation: 'blurIn',
  duration: 150,
  easing: 'ease',
  stagger: 5,
  sep: 'word',
};

const WS = /\s/;
const WS_ONLY = /^\s+$/;

/** Same word splitting as Streamdown's animate rehype plugin (`sep: 'word'`) */
function streamdownWordSplit(text: string): string[] {
  const tokens: string[] = [];
  let chunk = '';
  let inWs = false;
  for (const char of text) {
    const isWs = WS.test(char);
    if (isWs !== inWs && chunk) {
      tokens.push(chunk);
      chunk = '';
    }
    chunk += char;
    inWs = isWs;
  }
  if (chunk) tokens.push(chunk);
  return tokens;
}

function streamdownBlurStyle(wordIndex: number): CSSProperties {
  const { animation, duration, easing } = STREAMDOWN_BLUR_OPTIONS;
  return {
    '--sd-animation': `sd-${animation}`,
    '--sd-duration': `${duration}ms`,
    '--sd-easing': easing ?? 'ease',
    '--sd-delay': `${wordIndex * (STREAMDOWN_BLUR_OPTIONS.stagger ?? 8)}ms`,
  } as CSSProperties;
}

export function streamdownBlurred(
  tag: string,
  attrs: Record<string, string>,
  fullText: string,
  offset: number,
  wordOffset = 0,
): string {
  const blockStart = fullText.lastIndexOf('\n\n', Math.max(0, offset - 1));
  const textBeforeOffet = fullText.slice(blockStart === -1 ? 0 : blockStart + 2, offset);

  const stripped = textBeforeOffet.replace(new RegExp(`\\x00${CODE_MARKER}\\d+\\x00`, 'g'), ' ');
  const wordIndex =
    streamdownWordSplit(stripped).filter((t) => !WS_ONLY.test(t)).length + wordOffset;

  const parts = Object.entries({ ...attrs, [STREAMDOWN_WORD_INDEX]: String(wordIndex) }).map(
    ([k, v]) => `${k}="${v}"`,
  );
  return `<${tag} ${parts.join(' ')}></${tag}>`;
}

function streamdownBlurIndex(props: Record<string, unknown> & ExtraProps): number | undefined {
  const nodeProps = props.node?.properties ?? {};
  const raw =
    props[STREAMDOWN_WORD_INDEX] ??
    nodeProps[STREAMDOWN_WORD_INDEX] ??
    nodeProps.dataSdWordIndex ??
    nodeProps['data-sd-word-index'];
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) ? n : undefined;
}

// eslint-disable-next-line react-refresh/only-export-components
function StreamdownBlur({ blurIndex, children }: { blurIndex?: number; children: ReactNode }) {
  const { isAnimating } = useContext(StreamdownContext);
  if (!isAnimating || blurIndex === undefined) return children;
  return (
    <span data-sd-animate style={streamdownBlurStyle(blurIndex)}>
      {children}
    </span>
  );
}

export function withStreamdownBlur<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
): ComponentType<P> {
  return (props: P) => (
    <StreamdownBlur blurIndex={streamdownBlurIndex(props)}>
      <Component {...props} />
    </StreamdownBlur>
  );
}
