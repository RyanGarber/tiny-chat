import { type CSSProperties, ReactNode, useContext } from 'react';
import { Anchor, Pill, Stack, Text, Tooltip } from '@mantine/core';
import { Components } from 'streamdown';
import { MarkdownContext } from '@/utils/data.ts';
import { openExternal } from '@/utils/api.ts';
import { GLASS_STYLE, SHADOW } from '@/utils/theme.ts';
import { format } from 'timeago.js';
import { zData } from '@tiny-chat/shared/src/types/chat.ts';
import { scrubText, texts } from '@tiny-chat/shared/src/utils.ts';
import { Blockquote } from '@/features/message/components/Components.tsx';

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
  const { webReferences, memoryReferences, actionReferences } = useContext(MarkdownContext);
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
      const memory = memoryReferences.find((memory) => memory.id === id);
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
      const action = actionReferences.find((action) => action.id === id);
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
      const web = webReferences.find((webSearchResult) => webSearchResult.url === url);
      if (!web) return unknown({ key: i, id: url });
      let title = web.title;
      if (!title) {
        try {
          title = new URL(web.url).hostname;
        } catch {
          title = web.url;
        }
      }
      return (
        <Tooltip
          key={i}
          {...TOOLTIP_PROPS}
          label={
            <Stack gap="xs" maw={300}>
              <Text size="sm" fw={500} lineClamp={2}>
                {title}
              </Text>
              <Anchor
                size="xs"
                lineClamp={1}
                href={web.url}
                target="_blank"
                onClick={(e) => {
                  e.preventDefault();
                  void openExternal(web.url);
                }}
              >
                {web.url}
              </Anchor>
            </Stack>
          }
        >
          <Pill
            size="xs"
            style={{ ...PILL_BASE, cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              void openExternal(web.url);
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
  return <Blockquote model={node?.properties.model as string | undefined}>{children}</Blockquote>;
};

export const LinkComponent: Components['a'] = ({ href, children }) => {
  return (
    <a
      href={href}
      onClick={(e) => {
        if (!href) return;
        e.preventDefault();
        void openExternal(href);
      }}
    >
      {children}
    </a>
  );
};
