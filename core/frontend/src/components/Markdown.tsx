import { CSSProperties, memo, useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import { Typography } from '@mantine/core';
import RemarkGfm from 'remark-gfm';
import RemarkBreaks from 'remark-breaks';
import 'katex/dist/katex.min.css';
import { normalizeText } from '@tiny-chat/core-backend/src/types.ts';
import { SKIP, visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Element, Root, Text as HastText } from 'hast';
import { SearchResult } from '../../../backend/src/providers/web';
import { usePersistence } from '@/stores/persistence.tsx';
import {
  BlockquoteRenderer,
  CodeRenderer,
  FooterRenderer,
  LinkRenderer,
  SectionRenderer,
  TableRenderer,
} from '@/components/MarkdownComponents.tsx';
import {
  CODE_MARKER,
  MarkdownContext,
  MATH_MARKER,
  STREAMING_MARKER,
  WRITING_MARKER,
} from '@/utils/text.ts';

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
    const memories = usePersistence((s) => s.memories);
    const actions = usePersistence((s) => s.actions);

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
