import { CSSProperties, Fragment, memo, useMemo, createContext, useContext } from 'react';
import { getTextFromChildren, scrubText, takeStringOutOfNodeAndChildren } from '@/utils/text';
import { openExternal } from '@/utils/ui';
import ReactMarkdown, { Components } from 'react-markdown';
import {
  Blockquote,
  Group,
  ScrollArea,
  Text,
  ThemeIcon,
  Tooltip,
  Stack,
  Anchor,
  Pill,
  Typography,
} from '@mantine/core';
import RemarkGfm from 'remark-gfm';
import RemarkBreaks from 'remark-breaks';
import { CodeHighlight } from '@mantine/code-highlight';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Icon } from '@iconify/react';
import { normalizeText, texts, zData } from '@tiny-chat/core-backend/src/types.ts';
import { visit, SKIP } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Element, Text as HastText } from 'hast';
import { SearchResult } from '../../../backend/src/providers/web';
import { usePersistence } from '@/stores/persistence.tsx';
import { format } from 'timeago.js';

const MarkdownContext = createContext<{ webSearchResults: SearchResult[] }>({
  webSearchResults: [],
});

const rehypeStreamFade: Plugin<[], Root> = () => {
  return (tree) => {
    let totalLength = 0;
    visit(tree, 'text', (node: HastText) => {
      totalLength += node.value.length;
    });

    if (totalLength === 0) return;

    const animateChars = 15;
    const startIndex = Math.max(0, totalLength - animateChars);

    let currentIndex = 0;

    visit(tree, 'text', (node: HastText, index, parent) => {
      if (!parent || typeof index !== 'number') return;

      const nodeStart = currentIndex;
      const nodeLength = node.value.length;
      const nodeEnd = nodeStart + nodeLength;
      currentIndex += nodeLength;

      if (nodeEnd <= startIndex) return;

      const staticLength = Math.max(0, startIndex - nodeStart);
      const staticStr = node.value.slice(0, staticLength);
      const animatedStr = node.value.slice(staticLength);

      const newNodes: (HastText | Element)[] = [];
      if (staticStr) {
        newNodes.push({ type: 'text', value: staticStr });
      }

      for (let i = 0; i < animatedStr.length; i++) {
        const char = animatedStr[i];
        if (char.trim() === '') {
          const last = newNodes[newNodes.length - 1];
          if (last?.type === 'text') {
            last.value += char;
          } else {
            newNodes.push({ type: 'text', value: char });
          }
          continue;
        }

        const globalCharIndex = nodeStart + staticLength + i;
        newNodes.push({
          type: 'element',
          tagName: 'span',
          properties: {
            className: ['stream-char-fade'],
            key: `char-fade-${globalCharIndex}`,
          },
          children: [{ type: 'text', value: char }],
        });
      }

      parent.children.splice(index, 1, ...newNodes);
      return [SKIP, index + newNodes.length];
    });
  };
};

const STREAMING_MARKER = '\uE000';
const MATH_MARKER = '\uE001';
const CODE_MARKER = '\uE002';
const WRITING_MARKER = '\uE003';

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

const BlockquoteRenderer: Components['blockquote'] = (node) => {
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

const LinkRenderer: Components['a'] = (props) => {
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

const CodeRenderer: Components['code'] = memo((node) => {
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

const TableRenderer: Components['table'] = (node) => {
  return (
    <ScrollArea scrollbars="x" type="always">
      <table>{node.children}</table>
    </ScrollArea>
  );
};

const SectionRenderer: Components['section'] = (props) => {
  if ('data-footnotes' in props) {
    return null;
  }
  return <section {...props} />;
};

const FooterRenderer: Components['footer'] = () => {
  return null;
};

const markdownComponents: Components = {
  blockquote: BlockquoteRenderer,
  a: LinkRenderer,
  code: CodeRenderer,
  table: TableRenderer,
  section: SectionRenderer,
  footer: FooterRenderer,
};

const LATEX_CHAR_RE = /[\\^_{}]|\\[a-zA-Z]/;

const filter = (text: string, citationIds: Set<string>) => {
  text = normalizeText(text);

  text = text.replace(/\[(\^*[^[\]]+)]/g, (match, inner: string) => {
    // Strip all leading carets from each comma-separated segment, then check for valid IDs
    const ids = inner
      .split(',')
      .map((segment) => segment.replace(/^\^+/, '').trim())
      .filter((id) => citationIds.has(id));

    if (ids.length === 0) return match; // Not a citation bracket, leave it alone
    return ids.map((id) => `[^${id}]`).join('');
  });

  text = text.replace(/((?:^::>:: .*$\n?)+)/gm, (block) =>
    block.replace(/^::>:: (.*)$/gm, '> ::>:: $1'),
  );

  // Convert :::writing ... ::: directive blocks into standard blockquotes with the writing marker
  text = text.replace(/^:::writing\s*\n([\s\S]*?)^:::\s*$/gm, (_, content: string) => {
    const lines = content.trimEnd().split('\n');
    return lines.map((l: string, i: number) => `> ${i === 0 ? WRITING_MARKER : ''}${l}`).join('\n');
  });

  const codeBlocks: string[] = [];
  text = text.replace(/(`{3,}[\s\S]*?`{3,}|``[^`\n]*``|`[^`\n]+`)/g, (match) => {
    codeBlocks.push(match);
    return `\x00${CODE_MARKER}${codeBlocks.length - 1}\x00`;
  });

  // Step 2: Display math — $$...$$ (block only, must be alone on line)
  text = text.replace(
    /^[ \t]*\$\$([\s\S]*?)\$\$[ \t]*$/gm,
    (_, inner: string) => '```math\n' + inner.trim() + '\n```',
  );

  // Step 3: Display math — \[...\] (block, possibly multiline)
  text = text.replace(
    /^[ \t]*\\\[([\s\S]*?)\\][ \t]*$/gm,
    (_, inner: string) => '```math\n' + inner.trim() + '\n```',
  );

  // Step 4: Inline math — \(...\)
  text = text.replace(/\\\(([^\n]*?)\\\)/g, (match, inner: string) => {
    if (!LATEX_CHAR_RE.test(inner)) return match;
    return '`' + MATH_MARKER + inner.trim() + '`';
  });

  // Step 5: Inline math — $...$ (conservative fallback for non-compliant model output)
  text = text.replace(
    /(?<![\\$a-zA-Z\d])\$((?:[^$\\\n\s[\]]|\\.)+?)\$(?!\$)/g,
    (match, inner: string) => {
      const trimmed = inner.trim();
      if (!trimmed) return match;
      if (/^[a-zA-Z]$/.test(trimmed)) return '`' + MATH_MARKER + trimmed + '`';

      // Must pass at least one of these to be treated as math:
      const hasMathStructure =
        // Has explicit LaTeX: \frac, ^2, a_n, {}, etc.
        /[\\^_{}]/.test(trimmed) ||
        // Has math operator with spacing or between operands: 15 / 45, 10 + 30, x = 4
        /[\d\w]\s*[+\-*=]\s*[\d\w(]/.test(trimmed) || // ([+\-*/=] - / removed due to things like "$5/day, $35/week")
        // Is a pure number (integer or decimal), nothing else: 15, 15.25
        /^-?\d+(\.\d+)?$/.test(trimmed);

      if (!hasMathStructure) return match;

      return '`' + MATH_MARKER + trimmed + '`';
    },
  );

  // Step 6: Restore code blocks
  text = text.replace(
    new RegExp(`\\x00${CODE_MARKER}(\\d+)\\x00`, 'g'),
    (_, i: string) => codeBlocks[parseInt(i)],
  );

  // Step 7: Add plaintext language to code blocks without a language
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

  const backticks = text.match(/```/g)?.length ?? 0;
  if (backticks !== 0 && backticks % 2 !== 0) {
    text = text + STREAMING_MARKER + '\n```';
  }
  return text;
};

export const Markdown = memo(
  ({
    source,
    style,
    maw,
    isGenerating,
    webSearchResults,
  }: {
    source: string;
    style?: CSSProperties;
    maw?: number;
    isGenerating?: boolean;
    webSearchResults?: SearchResult[];
  }) => {
    const { memories, actions } = usePersistence();

    const { sourceWithCitations, knownIds } = useMemo(() => {
      let footnotes = '';
      const knownIds = new Set<string>();

      if (webSearchResults?.length) {
        footnotes +=
          '\n' +
          webSearchResults
            .map((c) => {
              knownIds.add(c.id);
              return `[^${c.id}]: ${c.source}`;
            })
            .join('\n');
      }
      if (memories.length) {
        footnotes +=
          '\n' +
          memories
            .map((m) => {
              knownIds.add(m.id);
              return `[^${m.id}]: ${m.fact}`;
            })
            .join('\n');
      }
      if (actions.length) {
        footnotes +=
          '\n' +
          actions
            .map((a) => {
              knownIds.add(a.id);
              return `[^${a.id}]: ${a.schedule}`;
            })
            .join('\n');
      }

      const matches = source.matchAll(/\[\^(\w{3,30})]/g);
      const orphans = new Set<string>();
      for (const m of matches) {
        if (!knownIds.has(m[1])) orphans.add(m[1]);
      }
      if (orphans.size) {
        footnotes +=
          '\n' +
          Array.from(orphans)
            .map((id) => `[^${id}]: unknown`)
            .join('\n');
      }

      if (footnotes.length) {
        let adjustedSource = source;
        const backticks = (adjustedSource.match(/```/g) ?? []).length;
        if (backticks % 2 !== 0) {
          adjustedSource = adjustedSource + STREAMING_MARKER + '\n```';
        }
        return { sourceWithCitations: `${adjustedSource}\n${footnotes}`, knownIds };
      }

      return { sourceWithCitations: source, knownIds };
    }, [source, webSearchResults, memories, actions]);

    const contextValue = useMemo(
      () => ({ webSearchResults: webSearchResults ?? [] }),
      [webSearchResults],
    );

    return (
      <MarkdownContext.Provider value={contextValue}>
        <Typography style={{ overflowWrap: 'break-word', ...style }} maw={maw}>
          <ReactMarkdown
            skipHtml
            remarkPlugins={[RemarkGfm, RemarkBreaks]}
            rehypePlugins={isGenerating ? [rehypeStreamFade] : []}
            components={markdownComponents}
          >
            {filter(sourceWithCitations, knownIds)}
          </ReactMarkdown>
        </Typography>
      </MarkdownContext.Provider>
    );
  },
  (prev, next) =>
    prev.source === next.source &&
    prev.style === next.style &&
    prev.isGenerating === next.isGenerating &&
    prev.webSearchResults === next.webSearchResults, // Compare reference is enough for tool results
);
