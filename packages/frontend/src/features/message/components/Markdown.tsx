import { memo, useMemo } from 'react';
import { AnimateOptions, type Components, defaultRemarkPlugins, type PluginConfig, Streamdown, } from 'streamdown';
import { Typography, TypographyProps } from '@mantine/core';
import RemarkBreaks from 'remark-breaks';
import RemarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import {
  BlockquoteComponent,
  CiteComponent,
  DiffRenderer,
  LinkComponent,
  TableComponent,
} from '@/features/message/components/MarkdownComponents.tsx';
import { MarkdownContext } from '@/utils/data.ts';
import { createMathPlugin } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import { code } from '@streamdown/code';
import { useThemes } from '@/features/settings/hooks/useThemes.ts';
import 'katex/dist/katex.min.css';
import { Root } from 'mdast';
import { xmlToDirective } from '@tiny-chat/shared/src/utils/text.ts';

const markdownComponents: Components = {
  blockquote: BlockquoteComponent,
  a: LinkComponent,
  table: TableComponent,
  cite: CiteComponent,
};

// reference tag passes id + animate index through sanitizer; all others blocked by default
const CUSTOM_TAGS = { blockquote: ['model'], cite: ['type', 'id', 'url', 'inline'] };

const REMARK_PLUGINS = [
  ...Object.values(defaultRemarkPlugins),
  RemarkBreaks,
  RemarkDirective,
  function directives() {
    return (tree: Root) => {
      visit(tree, (node) => {
        if (node.type === 'containerDirective' || node.type === 'textDirective') {
          if (node.name === 'quote' || node.name === 'writing') {
            node.data ??= {};
            node.data.hName = 'blockquote';
            node.data.hProperties = { ...node.attributes };
          }
          if (node.name === 'ref') {
            node.data ??= {};
            node.data.hName = 'cite';
            node.data.hProperties = { ...node.attributes };
          }
        }
      });
    };
  },
];

const PLUGINS: PluginConfig = {
  math: createMathPlugin({ singleDollarTextMath: false }),
  mermaid,
  code,
  renderers: [{ language: 'diff', component: DiffRenderer }],
};

const ANIMATE_OPTIONS: AnimateOptions = {
  animation: 'blurIn',
  duration: 150,
  easing: 'ease',
  stagger: 5,
  sep: 'word',
};

export const Markdown = memo(
  ({
    source,
    typographyProps,
    context = {
      webSearchResults: [],
      memories: [],
      actions: [],
      isGenerating: false,
    },
  }: {
    source: string;
    typographyProps?: TypographyProps;
    context?: MarkdownContext;
  }) => {
    const { codeTheme, theme } = useThemes();

    const props = useMemo(
      () => ({
        ...typographyProps,
        style: { overflowWrap: 'break-word' as const, ...typographyProps?.style },
      }),
      [typographyProps],
    );

    const content = useMemo(() => {
      return xmlToDirective(source, ['ref']);
    }, [source]);

    return (
      <MarkdownContext.Provider value={context}>
        <Typography {...props}>
          <Streamdown
            animated={ANIMATE_OPTIONS}
            isAnimating={context.isGenerating}
            mode={context.isGenerating ? 'streaming' : 'static'}
            components={markdownComponents}
            allowedTags={CUSTOM_TAGS}
            plugins={PLUGINS}
            remarkPlugins={REMARK_PLUGINS}
            shikiTheme={[codeTheme.data, codeTheme.data]}
            mermaid={{ config: { theme: theme.data === 'dark' ? 'dark' : 'neutral' } }}
            className="selectable"
          >
            {content}
          </Streamdown>
        </Typography>
      </MarkdownContext.Provider>
    );
  },
  (prev, next) =>
    prev.source === next.source &&
    prev.typographyProps === next.typographyProps &&
    prev.context?.isGenerating === next.context?.isGenerating &&
    prev.context?.webSearchResults === next.context?.webSearchResults &&
    prev.context?.memories === next.context?.memories &&
    prev.context?.actions === next.context?.actions, // TODO - value comparison
);
