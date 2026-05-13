import { type ComponentType, type CSSProperties, type ReactNode, useContext } from 'react';
import { StreamdownContext, type AnimateOptions, type ExtraProps } from 'streamdown';
import { CODE_MARKER } from '@/utils/text.ts';

export const BLUR_ATTRIBUTE = 'data-sd-word-index';
export const BLUR_OPTIONS: AnimateOptions = {
  animation: 'blurIn',
  duration: 150,
  easing: 'ease',
  stagger: 5,
  sep: 'word',
};

const WS = /\s/;
const WS_ONLY = /^\s+$/;

/** Same word splitting as Streamdown's animate rehype plugin (`sep: 'word'`) */
function splitWords(text: string): string[] {
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

function blurStyle(wordIndex: number): CSSProperties {
  const { animation, duration, easing } = BLUR_OPTIONS;
  return {
    '--sd-animation': `sd-${animation}`,
    '--sd-duration': `${duration}ms`,
    '--sd-easing': easing ?? 'ease',
    '--sd-delay': `${wordIndex * (BLUR_OPTIONS.stagger ?? 8)}ms`,
  } as CSSProperties;
}

export function blurred(
  tag: string,
  attrs: Record<string, string>,
  fullText: string,
  offset: number,
  wordOffset = 0,
): string {
  const blockStart = fullText.lastIndexOf('\n\n', Math.max(0, offset - 1));
  const textBeforeOffet = fullText.slice(blockStart === -1 ? 0 : blockStart + 2, offset);

  const stripped = textBeforeOffet.replace(new RegExp(`\\x00${CODE_MARKER}\\d+\\x00`, 'g'), ' ');
  const wordIndex = splitWords(stripped).filter((t) => !WS_ONLY.test(t)).length + wordOffset;

  const parts = Object.entries({ ...attrs, [BLUR_ATTRIBUTE]: String(wordIndex) }).map(
    ([k, v]) => `${k}="${v}"`,
  );
  return `<${tag} ${parts.join(' ')}></${tag}>`;
}

function getBlurIndex(props: Record<string, unknown> & ExtraProps): number | undefined {
  const nodeProps = props.node?.properties ?? {};
  const raw =
    props[BLUR_ATTRIBUTE] ??
    nodeProps[BLUR_ATTRIBUTE] ??
    nodeProps.dataSdWordIndex ??
    nodeProps['data-sd-word-index'];
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) ? n : undefined;
}

// eslint-disable-next-line react-refresh/only-export-components
function Blur({ blurIndex, children }: { blurIndex?: number; children: ReactNode }) {
  const { isAnimating } = useContext(StreamdownContext);
  if (!isAnimating || blurIndex === undefined) return children;
  return (
    <span data-sd-animate style={blurStyle(blurIndex)}>
      {children}
    </span>
  );
}

export function withBlur<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
): ComponentType<P> {
  const Wrapped = (props: P) => (
    <Blur blurIndex={getBlurIndex(props)}>
      <Component {...props} />
    </Blur>
  );
  return Wrapped;
}
