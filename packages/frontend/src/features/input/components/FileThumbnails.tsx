import { useState } from 'react';
import { Avatar, Image, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FilePreview, FilePreviewItem } from '@/features/input/components/FilePreview.tsx';
import { theme } from '@/utils/icon.ts';
import { useMutation } from '@tanstack/react-query';
import { trpc } from '@/utils/api.ts';
import { pathName } from '@tiny-chat/shared/src/utils/files.ts';

export default function FileThumbnails({
  uploads,
  size = 30,
}: {
  uploads: { id: string; name: string; thumbnail?: string }[];
  size?: number;
  width?: number | string;
  maxHeight?: number;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [initialIndex, setInitialIndex] = useState(0);
  const [fileData, setFileData] = useState<FilePreviewItem[] | null>(null);
  const loadFileData = useMutation({
    mutationKey: ['load-file-data'] as const,
    mutationFn: async () => {
      return await trpc.input.findFilesInUploads.query({
        files: uploads.map((upload) => ({ uploadId: upload.id, uploadName: upload.name })),
      });
    },
  });

  return (
    <>
      <FilePreview
        key={initialIndex}
        opened={opened}
        onClose={close}
        items={fileData}
        initialIndex={initialIndex}
      />
      <Avatar.Group>
        {uploads.map((upload, i) => {
          const iconId = theme.getFileIconId(upload.name ?? '', undefined, false);
          const icon = iconId ? theme.getIconContent(iconId, 'base64') : null;
          return (
            <Tooltip label={upload.name} key={upload.name} color="gray" position="bottom">
              <Avatar
                radius="xl"
                size={size}
                src={upload.thumbnail ?? null}
                bd="2px solid var(--mantine-color-default-border)"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  loadFileData
                    .mutateAsync()
                    .then((data) => {
                      setFileData(
                        data.map((data, i) => {
                          if (!data)
                            return {
                              name: uploads[i].name,
                              data: '[failed to load]',
                              mime: 'text/plain',
                            };
                          let binary = '';
                          const length = data.data.length;
                          for (let i = 0; i < length; i++) {
                            binary += String.fromCharCode(data.data[i]);
                          }
                          return { name: pathName(data.path), mime: data.mime, data: btoa(binary) };
                        }),
                      );
                      setInitialIndex(i);
                      open();
                    })
                    .catch(console.error);
                }}
              >
                <Image
                  src={upload.thumbnail ?? `data:${icon?.mimeType};base64,${icon?.data}`}
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
