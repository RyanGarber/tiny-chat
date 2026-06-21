import { useState } from 'react';
import { Avatar, Image, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FilePreview } from '@/features/input/components/FilePreview.tsx';
import { theme } from '@/utils/icon.ts';
import { mimeTypeFromExtension } from '@tiny-chat/shared/src/utils/files.ts';

export default function FileThumbnails({
  list,
  size = 30,
}: {
  list: { name: string; image?: string }[];
  size?: number;
  width?: number | string;
  maxHeight?: number;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [initialIndex, setInitialIndex] = useState(0);

  return (
    <>
      <FilePreview
        key={initialIndex}
        opened={opened}
        onClose={close}
        items={list.map((file) => ({
          name: file.name,
          mime: file.image
            ? file.image.split(';')[0].split(':')[1]
            : (mimeTypeFromExtension(file.name) ?? 'text/plain'),
          data: file.image ? file.image.split(',')[1] : 'NYI', // TODO
        }))}
        initialIndex={initialIndex}
      />
      <Avatar.Group>
        {list.map((file, i) => {
          const iconId = theme.getFileIconId(file.name ?? '', undefined, false);
          const icon = iconId ? theme.getIconContent(iconId, 'base64') : null;
          return (
            <Tooltip label={file.name} key={file.name} color="gray" position="bottom">
              <Avatar
                radius="xl"
                size={size}
                src={file.image ?? null}
                bd="2px solid var(--mantine-color-default-border)"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setInitialIndex(i);
                  open();
                }}
              >
                <Image
                  src={file.image ?? `data:${icon?.mimeType};base64,${icon?.data}`}
                  height={size * 0.6}
                />
              </Avatar>
            </Tooltip>
          );
        })}
      </Avatar.Group>
    </>
  );
}
