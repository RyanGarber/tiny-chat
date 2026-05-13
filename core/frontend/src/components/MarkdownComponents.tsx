import { Fragment, memo, useContext } from 'react';
import { usePersistence } from '@/stores/persistence.tsx';
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
import { Components } from 'react-markdown';
import {
  getTextFromChildren,
  MarkdownContext,
  MATH_MARKER,
  scrubText,
  STREAMING_MARKER,
  takeStringOutOfNodeAndChildren,
  WRITING_MARKER,
} from '@/utils/text.ts';
import { Icon } from '@iconify/react';
import { openExternal } from '@/utils/ui.ts';
import { format } from 'timeago.js';
import { CodeHighlight } from '@mantine/code-highlight';
import { texts, zData } from '@tiny-chat/core-backend/src/types.ts';
import katex from 'katex';

const renderKatex = (math: string, displayMode: boolean): string | null => {
  try {
    return katex.renderToString(math, {
      displayMode,
      throwOnError: false,
      output: 'html',
    });
  } catch {
    return null;
  }
};

export const BlockquoteRenderer: Components['blockquote'] = (node) => {
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

export const LinkRenderer: Components['a'] = (props) => {
  const { webSearchResults } = useContext(MarkdownContext);
  if ((props as { ['data-footnote-ref']?: string })['data-footnote-ref']) {
    const footnoteId = props.href?.replace('#user-content-fn-', '') ?? '';

    const citation = webSearchResults.find((c) => c.id === footnoteId);
    const memory = usePersistence.getState().memories.find((m) => m.id === footnoteId);
    const action = usePersistence.getState().actions.find((a) => a.id === footnoteId);

    if (citation) {
      return (
        <Tooltip
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
          multiline
          color="dark"
          position="bottom"
          bg="var(--tc-surface)"
          bd="1px solid var(--mantine-color-default-border)"
          p="md"
        >
          <Pill
            size="xs"
            style={{
              cursor: 'pointer',
              fontSize: '0.7em',
              margin: '0 2px',
              display: 'inline-flex',
            }}
            onClick={(e) => {
              e.preventDefault();
              void openExternal(citation.source);
            }}
          >
            {citation.title.length > 20 ? citation.title.slice(0, 17) + '…' : citation.title}
          </Pill>
        </Tooltip>
      );
    } else if (memory) {
      return (
        <Tooltip
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
          multiline
          color="dark"
          position="bottom"
          bg="var(--tc-surface)"
          bd="1px solid var(--mantine-color-default-border)"
          p="md"
        >
          <Pill
            size="xs"
            style={{
              cursor: 'default',
              fontSize: '0.7em',
              margin: '0 2px',
              display: 'inline-flex',
            }}
          >
            🧠
          </Pill>
        </Tooltip>
      );
    } else if (action?.nextRunAt) {
      return (
        <Tooltip
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
          multiline
          color="dark"
          position="bottom"
          bg="var(--tc-surface)"
          bd="1px solid var(--mantine-color-default-border)"
          p="md"
        >
          <Pill
            size="xs"
            style={{
              cursor: 'default',
              fontSize: '0.7em',
              margin: '0 2px',
              display: 'inline-flex',
            }}
          >
            ⚡
          </Pill>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip
          label={footnoteId}
          color="dark"
          position="bottom"
          bg="var(--tc-surface)"
          bd="1px solid var(--mantine-color-default-border)"
          p="xs"
        >
          <Pill
            size="xs"
            style={{
              cursor: 'help',
              fontSize: '0.7em',
              margin: '0 2px',
              display: 'inline-flex',
            }}
          >
            <Text span c="dimmed">
              ?
            </Text>
          </Pill>
        </Tooltip>
      );
    }
  }
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

export const CodeRenderer: Components['code'] = memo((node) => {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const rawCode = String(node.children ?? '');

  // Display math — converted from $$...$$ by filter()
  if (node.className === 'language-math') {
    const html = renderKatex(rawCode.trim(), true);
    if (html) return <span className="math-display" dangerouslySetInnerHTML={{ __html: html }} />;
    return <pre>{rawCode}</pre>;
  }

  // Inline math — converted from $...$ by filter()
  if (!node.className && rawCode.startsWith(MATH_MARKER)) {
    const math = rawCode.slice(MATH_MARKER.length);
    const html = renderKatex(math, false);
    if (html) return <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
    return <code>{math}</code>;
  }

  const isStreaming = rawCode.includes(STREAMING_MARKER);
  const code = (isStreaming ? rawCode.replace(STREAMING_MARKER, '') : rawCode).trimEnd();

  if (!node.className) {
    return <code>{code}</code>;
  }

  if (isStreaming) {
    return <pre style={{ padding: 25, maxHeight: 180, overflow: 'hidden' }}>{code}</pre>;
  }

  return (
    <div className="code-fade-in">
      <CodeHighlight
        code={code}
        language={node.className?.replace('language-', '')}
        withExpandButton={code.split('\n').length >= 8}
        defaultExpanded={code.split('\n').length < 8}
      />
    </div>
  );
});

export const TableRenderer: Components['table'] = (node) => {
  return (
    <ScrollArea scrollbars="x" type="always">
      <table>{node.children}</table>
    </ScrollArea>
  );
};

export const SectionRenderer: Components['section'] = (props) => {
  if ('data-footnotes' in props) {
    return null;
  }
  return <section {...props} />;
};

export const FooterRenderer: Components['footer'] = () => {
  return null;
};
