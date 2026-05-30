import { CSSProperties, memo, useMemo } from 'react';
import { type Components, defaultRemarkPlugins, type PluginConfig, Streamdown } from 'streamdown';
import { Typography } from '@mantine/core';
import RemarkBreaks from 'remark-breaks';
import { normalizeText } from '@tiny-chat/shared/src/utils.ts';
import {
  BlockquoteComponent,
  DiffRenderer,
  LinkComponent,
  ReferenceComponent,
  TableComponent,
} from '@/features/message/components/MarkdownComponents.tsx';
import { CODE_MARKER, MarkdownContext, WRITING_MARKER } from '@/utils/text.ts';
import { BLUR_ATTRIBUTE, BLUR_OPTIONS, blurred } from '@/utils/blur.tsx';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import { code } from '@streamdown/code';
import { useThemes } from '@/features/settings/hooks/useThemes.ts';
import 'katex/dist/katex.min.css';

const markdownComponents: Components = {
  blockquote: BlockquoteComponent,
  a: LinkComponent,
  table: TableComponent,
  reference: ReferenceComponent,
};

// reference tag passes id + animate index through sanitizer; all others blocked by default
const CUSTOM_TAGS = { reference: ['id', BLUR_ATTRIBUTE] };

const REMARK_PLUGINS = [...Object.values(defaultRemarkPlugins), RemarkBreaks];

const PLUGINS: PluginConfig = {
  math,
  mermaid,
  code,
  renderers: [{ language: 'diff', component: DiffRenderer }],
};

const filter = (text: string): string => {
  text = normalizeText(text);

  // Extract code spans and blocks before transforming to prevent false matches
  const codeBlocks: string[] = [];
  text = text.replace(/(`{3,}[\s\S]*?`{3,}|``[^`\n]*``|`[^`\n]+`)/g, (match) => {
    codeBlocks.push(match);
    return `\x00${CODE_MARKER}${codeBlocks.length - 1}\x00`;
  });

  // ::>:: lines → standard blockquote with the ::>:: prefix preserved for BlockquoteRenderer
  text = text.replace(/((?:^::>:: .*$\n?)+)/gm, (block) =>
    block.replace(/^::>:: (.*)$/gm, '> ::>:: $1'),
  );

  // :::writing ... ::: directive → blockquote with WRITING_MARKER on first line
  text = text.replace(/^:::writing\s*\n([\s\S]*?)^:::\s*$/gm, (_, content: string) => {
    const lines = content.trimEnd().split('\n');
    return lines.map((l: string, i: number) => `> ${i === 0 ? WRITING_MARKER : ''}${l}`).join('\n');
  });

  // [^id] / [^id1, id2] → <reference id="id"> tags (protected from remark-gfm footnote handling)
  text = text.replace(
    /\[((?:[a-z0-9]{6}|[a-z0-9]{30}|,| |\^)+)]/g,
    (match, inner: string, offset: number) => {
      const ids = inner
        .replace(/^\^+/, '')
        .split(',')
        .map((s) => s.trim())
        .filter((id) => /^\w{3,30}$/.test(id));
      if (ids.length === 0) return match;
      return ids.map((id, i) => blurred('reference', { id }, text, offset, i)).join('');
    },
  );

  // Restore code spans/blocks
  text = text.replace(
    new RegExp(`\\x00${CODE_MARKER}(\\d+)\\x00`, 'g'),
    (_, i: string) => codeBlocks[parseInt(i)],
  );

  // Ensure every fenced block has an explicit language (avoids unstyled blocks)
  let inBlock = false;
  text = text
    .split('\n')
    .map((line) => {
      if (!inBlock && /^```(\w*)$/.exec(line)) {
        inBlock = true;
        return line === '```' ? '```plaintext' : line;
      } else if (inBlock && /^```$/.exec(line)) {
        inBlock = false;
      }
      return line;
    })
    .join('\n');

  return text;
};

export const Markdown = memo(
  ({
    source,
    style,
    maw,
    context = {
      webSearchResults: [],
      memories: [],
      actions: [],
      isGenerating: false,
    },
  }: {
    source: string;
    style?: CSSProperties;
    maw?: number;
    context?: MarkdownContext;
  }) => {
    const processedSource = useMemo(() => filter(source), [source]);

    const { codeTheme, theme } = useThemes();

    return (
      <MarkdownContext.Provider value={context}>
        <Typography style={{ overflowWrap: 'break-word', ...style }} maw={maw}>
          <Streamdown
            animated={BLUR_OPTIONS}
            isAnimating={context.isGenerating}
            //caret="circle"
            mode={context.isGenerating ? 'streaming' : 'static'}
            components={markdownComponents}
            allowedTags={CUSTOM_TAGS}
            plugins={PLUGINS}
            remarkPlugins={REMARK_PLUGINS}
            shikiTheme={[codeTheme.data, codeTheme.data]}
            mermaid={{ config: { theme: theme.data === 'dark' ? 'dark' : 'neutral' } }}
          >
            {processedSource}
          </Streamdown>
        </Typography>
      </MarkdownContext.Provider>
    );
  },
  (prev, next) =>
    prev.source === next.source &&
    prev.style === next.style &&
    prev.context?.isGenerating === next.context?.isGenerating &&
    prev.context?.webSearchResults === next.context?.webSearchResults &&
    prev.context?.memories === next.context?.memories &&
    prev.context?.actions === next.context?.actions,
);
