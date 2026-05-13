import { Group, Menu, Modal, Tabs, Text } from '@mantine/core';
import { Icon } from '@iconify/react';
import { useState, useCallback } from 'react';
import { glassStyle } from '@/utils/glass';
import { UploadFile } from '@/features/input/components/UploadFile';
import { UploadRepo } from '@/features/input/components/UploadRepo';
import { isTauri } from '@/utils/api';
import { useUploads } from '../hooks/useUploads';
import { useMessaging } from '@/stores/messaging';

export default function Upload({
  opened,
  onClose,
  tab,
  onTabChange,
}: {
  opened: boolean;
  onClose: () => void;
  tab: 'file' | 'repo';
  onTabChange: (tab: 'file' | 'repo') => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={6}>
          <Icon icon={tab === 'file' ? 'lucide:file' : 'lucide:github'} height={18} />
          <Text fw={600}>{tab === 'file' ? 'Upload Files' : 'Repositories'}</Text>
        </Group>
      }
      size="lg"
      styles={{ content: glassStyle }}
      centered
    >
      <Tabs value={tab} onChange={(val) => onTabChange(val as 'file' | 'repo')}>
        <Tabs.List mb="md">
          <Tabs.Tab value="file" leftSection={<Icon icon="lucide:file" height={16} />}>
            Files
          </Tabs.Tab>
          <Tabs.Tab value="repo" leftSection={<Icon icon="lucide:github" height={16} />}>
            Repositories
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="file">
          <UploadFile onClose={onClose} />
        </Tabs.Panel>

        <Tabs.Panel value="repo">
          <UploadRepo onClose={onClose} />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

// --- Menu Items ---

export function FileMenuItem({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Menu.Item
      leftSection={<Icon icon="lucide:file" height={18} />}
      onClick={onClick}
      disabled={disabled}
    >
      File
    </Menu.Item>
  );
}

export function RepositoryMenuItem({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Menu.Item
      leftSection={<Icon icon="lucide:github" height={18} />}
      onClick={onClick}
      disabled={disabled}
    >
      Repository
    </Menu.Item>
  );
}

export function ScreenshotMenuItem({ disabled }: { disabled?: boolean }) {
  // Check for support
  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hasMediaDevices =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      'getDisplayMedia' in navigator.mediaDevices;
    return hasMediaDevices && !isTauri();
  });

  const { upload } = useUploads();
  const { addUploads } = useMessaging();

  const captureScreenshot = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx!.drawImage(video, 0, 0);
      stream.getTracks().forEach((track) => track.stop());

      canvas.toBlob((blob) => {
        if (blob) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = new File([blob], `Screenshot-${timestamp}.png`, { type: 'image/png' });
          upload.mutate(
            { type: 'upload', files: [file] },
            { onSuccess: (data) => addUploads(...data) },
          );
        }
      }, 'image/png');
    } catch (e) {
      console.error('Failed to capture screenshot:', e);
    }
  }, [addUploads, upload]);

  if (!supported) return null;

  return (
    <Menu.Item
      disabled={disabled}
      leftSection={<Icon icon="lucide:screen-share" height={18} />}
      onClick={() => void captureScreenshot()}
    >
      Screenshot
    </Menu.Item>
  );
}
