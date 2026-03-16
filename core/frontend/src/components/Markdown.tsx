import { CSSProperties, Fragment, memo } from 'react';
import { getTextFromChildren, takeStringOutOfNodeAndChildren } from '@/utils/text';
import { openExternal } from '@/utils/ui';
import ReactMarkdown, { Components } from 'react-markdown';
import { Blockquote, Group, ScrollArea, Text, ThemeIcon, Typography } from '@mantine/core';
import RemarkGfm from 'remark-gfm';
import RemarkBreaks from 'remark-breaks';
import { CodeHighlight } from '@mantine/code-highlight';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Icon } from '@iconify/react';
import { normalizeText } from '@tiny-chat/core-backend/src/types.ts';
import { visit, SKIP } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Element, Text as HastText } from 'hast';

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
          if (last && last.type === 'text') {
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

const components: Components = {
  blockquote: (node) => {
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
  },
  code: (node) => {
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
  },
  table: (node) => {
    return (
      <ScrollArea scrollbars="x" type="always">
        <table>{node.children}</table>
      </ScrollArea>
    );
  },
  a: (node) => {
    return (
      <a
        href={node.href}
        onClick={(e) => {
          if (!node.href) return;
          e.preventDefault();
          void openExternal(node.href);
        }}
      >
        {node.children}
      </a>
    );
  },
};

const LATEX_CHAR_RE = /[\\^_{}]|\\[a-zA-Z]/;

const filter = (text: string) => {
  text = normalizeText(text);

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

  // Step 2: Display math — $$...$$ (block, possibly multiline)
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
  // Allow any content that isn't a newline; filter false positives via LATEX_CHAR_RE
  text = text.replace(/\\\(([^\n]*?)\\\)/g, (match, inner: string) => {
    if (!LATEX_CHAR_RE.test(inner)) return match;
    return '`' + MATH_MARKER + inner.trim() + '`';
  });

  text = text.replace(
    /(?<![\\$a-zA-Z\d])\$[ \t]?((?:[^$\\\n]|\\.)+?)[ \t]?\$(?!\$)/g,
    (match, inner: string) => {
      const trimmed = inner.trim();
      if (!trimmed) return match;

      // Reject digit-leading content with no LaTeX chars (e.g. $20k, $500)
      if (/^\d/.test(trimmed) && !LATEX_CHAR_RE.test(trimmed)) return match;

      // Reject ${ template literals
      if (trimmed.startsWith('{')) return match;

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
  ({ source, style, maw, isGenerating }: { source: string; style?: CSSProperties; maw?: number; isGenerating?: boolean }) => {
    return (
      <Typography style={{ overflowWrap: 'break-word', ...style }} maw={maw}>
        <ReactMarkdown 
          skipHtml 
          remarkPlugins={[RemarkGfm, RemarkBreaks]} 
          rehypePlugins={isGenerating ? [rehypeStreamFade] : []}
          components={components}
        >
          {filter(source)}
        </ReactMarkdown>
      </Typography>
    );
  },
  (prev, next) => prev.source === next.source && prev.style === next.style && prev.isGenerating === next.isGenerating,
);
