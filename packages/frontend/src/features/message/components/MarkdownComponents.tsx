import { type ComponentType, type CSSProperties, Fragment, useContext } from 'react';
import {
  Anchor,
  Blockquote,
  Group,
  Pill,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  type BundledLanguage,
  type BundledTheme,
  CodeBlockContainer,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockHeader,
  Components,
  type CustomRendererProps,
} from 'streamdown';
import {
  DIFF_MARKER,
  getTextFromChildren,
  MarkdownContext,
  takeStringOutOfNodeAndChildren,
  WRITING_MARKER,
} from '@/utils/text.ts';
import { Icon } from '@iconify/react';
import { openExternal } from '@/utils/ui.ts';
import { format } from 'timeago.js';
import { zData } from '@tiny-chat/shared/src/types/chat.ts';
import { scrubText, texts } from '@tiny-chat/shared/src/utils.ts';
import { withBlur } from '@/utils/blur.tsx';
import type { ReactDiffViewerStylesOverride } from 'react-diff-viewer-continued';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { code as streamdownCode } from '@streamdown/code';
import { useThemes } from '@/features/settings/hooks/useThemes';
import { glassStyle } from '@/utils/glass';
import { SHADOW } from '@/utils/theme';

const TOOLTIP_PROPS = {
  multiline: true,
  position: 'bottom',
  style: { ...glassStyle, boxShadow: SHADOW },
  p: 'md',
  c: 'var(--mantine-color-text)',
} as const;

const PILL_BASE: CSSProperties = {
  height: 'auto',
  margin: 0,
  padding: '2px 5.25px',
  fontSize: '0.7em',
  display: 'inline-flex',
  cursor: 'default',
  background: 'var(--tc-interior)',
};

// Rendered for each [^id] citation reference inline
export const ReferenceComponent: Components['reference'] = withBlur((props) => {
  const { webSearchResults, memories, actions, isGenerating } = useContext(MarkdownContext);
  const referenceId = ((props.id ?? '') as string).replace('user-content-', '').trim();

  if (isGenerating) {
    return (
      <Pill size="xs" style={{ ...PILL_BASE, cursor: 'wait' }}>
        ⋯
      </Pill>
    );
  }

  if (referenceId) {
    const citation = webSearchResults.find((c) => c.id === referenceId);
    const memory = memories.find((m) => m.id === referenceId);
    const action = actions.find((a) => a.id === referenceId);

    if (citation) {
      return (
        <Tooltip
          {...TOOLTIP_PROPS}
          label={
            <Stack gap="xs" maw={300}>
              <Text size="sm" fw={500} lineClamp={2}>
                {citation.title}
              </Text>
              <Anchor size="xs" href={citation.source} target="_blank" lineClamp={1}>
                {citation.source}
              </Anchor>
            </Stack>
          }
        >
          <Pill
            size="xs"
            style={{ ...PILL_BASE, cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              void openExternal(citation.source);
            }}
          >
            🔗
          </Pill>
        </Tooltip>
      );
    }

    if (memory) {
      return (
        <Tooltip
          {...TOOLTIP_PROPS}
          label={
            <Stack gap="xs" maw={300}>
              <Text size="sm" fw={500} lineClamp={2}>
                {memory.fact}
              </Text>
              <Text size="xs" c="dimmed">
                Learned {format(memory.createdAt)}
              </Text>
            </Stack>
          }
        >
          <Pill size="xs" style={{ ...PILL_BASE }}>
            🧠
          </Pill>
        </Tooltip>
      );
    }

    if (action?.nextRunAt) {
      return (
        <Tooltip
          {...TOOLTIP_PROPS}
          label={
            <Stack gap="xs" maw={300}>
              <Text size="sm" fw={500} lineClamp={2}>
                {scrubText(texts(action.data as zData))}
              </Text>
              <Text size="xs" c="dimmed">
                {format(action.nextRunAt)}
              </Text>
            </Stack>
          }
        >
          <Pill size="xs" style={{ ...PILL_BASE }}>
            ⚡
          </Pill>
        </Tooltip>
      );
    }
  }

  return (
    <Tooltip {...TOOLTIP_PROPS} label={referenceId ?? 'Unknown reference'}>
      <Pill size="xs" style={{ ...PILL_BASE }}>
        <Text span c="dimmed">
          ﹖
        </Text>
      </Pill>
    </Tooltip>
  );
});

export const BlockquoteComponent: Components['blockquote'] = (node) => {
  const text = getTextFromChildren(node.children);

  if (text.trim().startsWith(WRITING_MARKER)) {
    return (
      <Blockquote
        icon={
          <ThemeIcon variant="transparent" color="dimmed">
            <Icon icon="lucide:pencil-line" height={18} />
          </ThemeIcon>
        }
      >
        {takeStringOutOfNodeAndChildren(node.children, WRITING_MARKER)}
      </Blockquote>
    );
  }

  if (text.trim().startsWith('::>:: ')) {
    const lines = text.split('\n');
    let modelName = '';
    let contentLines = lines;

    const firstContent = lines[0].replace(/^::>::\s?/, '');
    if (firstContent.startsWith('::model=') && firstContent.endsWith('::')) {
      modelName = firstContent.slice('::model='.length, -2);
      contentLines = lines.slice(1);
    }

    return (
      <>
        {modelName && (
          <Group gap={5} c="dimmed" mb={4}>
            <Icon
              icon="lucide:message-square-quote"
              height={14}
              style={{ transform: 'scale(-1,1)' }}
            />
            <Text size="xs">{modelName}</Text>
          </Group>
        )}
        <Blockquote className="ignore-typography" mb="var(--mantine-spacing-lg)">
          {contentLines.map((line, index) => (
            <Fragment key={index}>
              {line.replace(/^::>::\s?/gm, '')}
              {index < contentLines.length - 1 && <br />}
            </Fragment>
          ))}
        </Blockquote>
      </>
    );
  }

  return <Blockquote>{node.children}</Blockquote>;
};

export const LinkComponent: Components['a'] = (props) => {
  return (
    <a
      href={props.href}
      onClick={(e) => {
        if (!props.href) return;
        e.preventDefault();
        void openExternal(props.href);
      }}
    >
      {props.children}
    </a>
  );
};

export const TableComponent: Components['table'] = (node) => {
  return (
    <ScrollArea scrollbars="x" type="always">
      <table>{node.children}</table>
    </ScrollArea>
  );
};

const _highlight = (language: string, codeTheme: string, code: string) => {
  if (!streamdownCode.supportsLanguage(language as BundledLanguage)) {
    return null;
  }

  return streamdownCode.highlight({
    code,
    language: language as BundledLanguage,
    themes: [codeTheme as BundledTheme, codeTheme as BundledTheme],
  });
};

const highlight = (language: string, codeTheme: string) => (code: string) => {
  const result = _highlight(language, codeTheme, code);

  if (!result) return <span>{code}</span>;

  return (
    <span>
      {result.tokens[0]?.map((token, i) => (
        <span
          key={i}
          style={{ color: token.htmlStyle?.color, fontStyle: token.htmlStyle?.fontStyle }}
        >
          {token.content}
        </span>
      ))}
    </span>
  );
};

export const DiffRenderer: ComponentType<CustomRendererProps> = (props) => {
  const { theme, codeTheme } = useThemes();

  const path = props.meta ?? '';
  const language = path.split('.').slice(-1)[0] ?? 'plaintext';
  const [oldCode, newCode] = props.code
    .split(new RegExp(`\\s*${DIFF_MARKER}\\s*`))
    .map((code) => code.trim());

  const result = _highlight(language, codeTheme.data, '');
  const styles: ReactDiffViewerStylesOverride | undefined = result
    ? {
        variables: {
          light: {
            diffViewerTitleBackground: result?.bg,
            diffViewerTitleColor: result?.fg,
            diffViewerBackground: result?.bg,
            diffViewerColor: result?.fg,
            gutterColor: result?.fg,
            emptyLineBackground: result?.bg,
            wordAddedBackground: 'rgba(0, 0, 0, 0.1)',
            wordRemovedBackground: 'rgba(0, 0, 0, 0.1)',
          },
          dark: {
            diffViewerTitleBackground: result?.bg,
            diffViewerTitleColor: result?.fg,
            diffViewerBackground: result?.bg,
            diffViewerColor: result?.fg,
            gutterColor: result?.fg,
            emptyLineBackground: result?.bg,
            wordAddedBackground: 'rgba(100, 255, 100, 0.1)',
            wordRemovedBackground: 'rgba(255, 100, 100, 0.1)',
          },
        },
      }
    : undefined;

  return (
    <CodeBlockContainer language="diff">
      <CodeBlockHeader language={path} />
      <div
        className={'pointer-events-none sticky top-2 z-10 -mt-10 flex h-8 items-center justify-end'}
      >
        <div
          className={
            'pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/80 px-1.5 py-1 supports-backdrop-filter:bg-sidebar/70 supports-backdrop-filter:backdrop-blur'
          }
          data-streamdown="code-block-actions"
        >
          <CodeBlockCopyButton code={newCode} />
          <CodeBlockDownloadButton code={newCode} language={language} />
        </div>
      </div>
      <ReactDiffViewer
        oldValue={oldCode}
        newValue={newCode}
        splitView={false}
        useDarkTheme={theme.data === 'dark'}
        renderContent={highlight(language, codeTheme.data)}
        hideLineNumbers={true}
        styles={styles}
      />
    </CodeBlockContainer>
  );
};
