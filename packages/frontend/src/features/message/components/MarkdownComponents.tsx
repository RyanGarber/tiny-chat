import { type ComponentType, type CSSProperties, ReactNode, useContext } from 'react';
import { Anchor, Blockquote, Group, Pill, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import {
  type BundledLanguage,
  type BundledTheme,
  CodeBlockContainer,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockHeader,
  Components,
  type CustomRendererProps,
  TableCopyDropdown,
  TableDownloadDropdown,
} from 'streamdown';
import { DIFF_MARKER, MarkdownContext } from '@/utils/data.ts';
import { Icon } from '@iconify/react';
import { openExternal } from '@/utils/api.ts';
import { GLASS_STYLE, SHADOW } from '@/utils/theme.ts';
import { format } from 'timeago.js';
import { zData } from '@tiny-chat/shared/src/types/chat.ts';
import { scrubText, texts } from '@tiny-chat/shared/src/utils.ts';
import type { ReactDiffViewerStylesOverride } from 'react-diff-viewer-continued';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { code as streamdownCode } from '@streamdown/code';
import { useThemes } from '@/features/settings/hooks/useThemes';

const TOOLTIP_PROPS = {
  multiline: true,
  position: 'bottom',
  style: { ...GLASS_STYLE, boxShadow: SHADOW },
  p: 'md',
  c: 'var(--mantine-color-text)',
} as const;

const PILL_BASE: CSSProperties = {
  height: 'auto',
  margin: '0 2px',
  padding: '2px 5.25px',
  fontSize: '0.7em',
  display: 'inline-flex',
  cursor: 'default',
  background: 'var(--tc-interior)',
};

export const CiteComponent: Components['cite'] = ({ children, node }) => {
  const { webSearchResults, memories, actions } = useContext(MarkdownContext);
  const type = ((node?.properties.type ?? 'unknown') as string).trim();
  const ids = ((node?.properties.id ?? '-') as string)
    .replace('user-content-', '')
    .split(',')
    .map((id) => id.trim());
  const urls = ((node?.properties.url ?? '-') as string).split(',').map((url) => url.trim());

  const unknown = ({ key, id }: { key: number; id: string }) => {
    return (
      <Tooltip
        key={key}
        {...TOOLTIP_PROPS}
        label={
          <Stack gap="xs" maw={300}>
            <Text size="sm" fw={500}>
              Reference not found
            </Text>
            <Text size="xs" c="dimmed">
              {type}: {id}
            </Text>
          </Stack>
        }
      >
        <Pill size="xs" style={{ ...PILL_BASE }}>
          <Text span c="dimmed">
            ﹖
          </Text>
        </Pill>
      </Tooltip>
    );
  };

  let pills: ReactNode[];

  if (type === 'memory') {
    pills = ids.map((id, i) => {
      const memory = memories.find((memory) => memory.id === id);
      if (!memory) return unknown({ key: i, id });
      return (
        <Tooltip
          key={i}
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
    });
  } else if (type === 'action') {
    pills = ids.map((id, i) => {
      const action = actions.find((action) => action.id === id);
      if (!action) return unknown({ key: i, id });
      return (
        <Tooltip
          key={i}
          {...TOOLTIP_PROPS}
          label={
            <Stack gap="xs" maw={300}>
              <Text size="sm" fw={500} lineClamp={2}>
                {scrubText(texts(action.data as zData))}
              </Text>
              <Text size="xs" c="dimmed">
                {action.nextRunAt ? `Next run ${format(action.nextRunAt)}` : 'All runs completed'}
              </Text>
            </Stack>
          }
        >
          <Pill size="xs" style={{ ...PILL_BASE }}>
            ⚡
          </Pill>
        </Tooltip>
      );
    });
  } else if (type === 'web') {
    pills = urls.map((url, i) => {
      const webSearchResult = webSearchResults.find(
        (webSearchResult) => webSearchResult.url === url,
      );
      if (!webSearchResult) return unknown({ key: i, id: url });
      return (
        <Tooltip
          key={i}
          {...TOOLTIP_PROPS}
          label={
            <Stack gap="xs" maw={300}>
              <Text size="sm" fw={500} lineClamp={2}>
                {webSearchResult.title}
              </Text>
              <Anchor
                size="xs"
                lineClamp={1}
                href={webSearchResult.url}
                target="_blank"
                onClick={(e) => {
                  e.preventDefault();
                  void openExternal(webSearchResult.url);
                }}
              >
                {webSearchResult.url}
              </Anchor>
            </Stack>
          }
        >
          <Pill
            size="xs"
            style={{ ...PILL_BASE, cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              void openExternal(webSearchResult.url);
            }}
          >
            🔗
          </Pill>
        </Tooltip>
      );
    });
  } else {
    pills = [...ids, ...urls].map((id, i) => unknown({ key: i, id }));
  }

  return (
    <span>
      {children}
      {pills}
    </span>
  );
};

export const BlockquoteComponent: Components['blockquote'] = ({ node, children }) => {
  return (
    <>
      {node?.properties.model && (
        <Group gap={5} c="dimmed" mb={4}>
          <Icon
            icon="lucide:message-square-quote"
            height={14}
            style={{ transform: 'scale(-1,1)' }}
          />
          <Text size="xs">{node?.properties.model}</Text>
        </Group>
      )}
      <Blockquote
        {...(node?.properties.model
          ? { className: 'ignore-typography', mb: 'var(--mantine-spacing-lg)' }
          : {})}
      >
        {children}
      </Blockquote>
    </>
  );
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
    <div data-streamdown="table-wrapper">
      <ScrollArea scrollbars="x" type="always">
        <Group style={{ position: 'absolute', top: 6, right: 15 }} gap={5}>
          <TableDownloadDropdown />
          <TableCopyDropdown />
        </Group>
        <table>{node.children}</table>
      </ScrollArea>
    </div>
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
