import { useMessaging } from '@/stores/messaging.tsx';
import { setupEditor } from '@/slate/setup.tsx';
import { onKeyDown, onSend } from '@/slate/events.tsx';
import { decorate, renderElement, renderLeaf } from '@/slate/renderer.tsx';
import {
  ActionIcon,
  Box,
  Button,
  Divider,
  FileButton,
  InputBase,
  InputWrapper,
  InputWrapperProps,
  Menu,
  Popover,
  PopoverDropdown,
  PopoverTarget,
  ScrollAreaAutosize,
  Select,
  Slider,
  Stack,
  Text,
} from '@mantine/core';
import { CSSProperties, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Editable, ReactEditor, RenderElementProps, RenderLeafProps, Slate } from 'slate-react';
import { serialize } from '@/slate/serializer.tsx';
import { useProviders } from '@/stores/providers.tsx';
import { useLayout } from '@/stores/layout.tsx';
import { useLocalStorage } from '@mantine/hooks';
import { DropzoneFullScreen } from '@mantine/dropzone';
import ModelSelect from '@/components/ModelSelect.tsx';
import { Icon } from '@iconify/react';
import { NodeEntry } from 'slate';
import GitHub from '@/components/GitHub.tsx';

import { uploadFiles } from '@/managers/uploading.ts';

export function Input(props: InputWrapperProps) {
  const { setEditor, config, setConfig, isUploading } = useMessaging();
  const { chatProviders, abortController } = useProviders();
  const { shadow, setIsMessaging, isMessagingDisabled } = useLayout();

  const [isMultiline, setMultiline] = useState(false);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftSectionRef = useRef<HTMLDivElement>(null);
  const rightSectionRef = useRef<HTMLDivElement>(null);

  const [editor] = useState(() => setupEditor());
  useLayoutEffect(() => setEditor(editor), [editor, setEditor]);

  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const height = entry.contentRect.height;
      if (height > 40) setMultiline(true);
    });
    if (scrollRef.current) {
      observer.observe(scrollRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const [sectionWidths, setSectionWidths] = useState({ left: 42, right: 42 });
  useLayoutEffect(() => {
    const updateWidths = () => {
      const leftWidth = leftSectionRef.current?.offsetWidth ?? 42;
      const rightWidth = rightSectionRef.current?.offsetWidth ?? 42;
      setSectionWidths({ left: leftWidth, right: rightWidth });
    };

    updateWidths();
    const observer = new ResizeObserver(updateWidths);

    if (leftSectionRef.current) observer.observe(leftSectionRef.current);
    if (rightSectionRef.current) observer.observe(rightSectionRef.current);

    return () => observer.disconnect();
  }, []);

  const [, updateSavedConfig] = useLocalStorage<string>({ key: 'config' });

  const args =
    chatProviders
      .find((s) => s.name === config?.provider)
      ?.models.find((m) => m.name === config?.model)?.args ?? [];

  const setArg = (name: string, value: unknown) => {
    if (!config) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const newConfig = { ...config, args: { ...config.args, [name]: value } };
    setConfig(newConfig);
    updateSavedConfig(JSON.stringify(newConfig));
  };

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
          const file = new File([blob], `screenshot-${timestamp}.png`, { type: 'image/png' });
          void uploadFiles([file]);
        }
      }, 'image/png');
    } catch (e) {
      console.error('Failed to capture screenshot:', e);
    }
  }, []);

  const resetMultiline = useCallback(() => {
    if (!serialize().length) setMultiline(false);
  }, [setMultiline]);

  const leftActionContent = (
    <Menu position="top-start" transitionProps={{ transition: 'fade-up' }}>
      <Menu.Target>
        <ActionIcon variant="subtle" size={32} disabled={isMessagingDisabled || isUploading}>
          <Icon icon="lucide:paperclip" height={18} />
          <DropzoneFullScreen onDrop={(files) => void uploadFiles(files)} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown style={{ boxShadow: shadow }}>
        <FileButton onChange={(files) => void uploadFiles(files)} multiple disabled={isUploading}>
          {(props) => (
            <Menu.Item
              {...props}
              leftSection={<Icon icon="lucide:file" height={18} />}
              closeMenuOnClick={false}
            >
              File
            </Menu.Item>
          )}
        </FileButton>
        <Menu.Item
          disabled={isUploading}
          leftSection={<Icon icon="lucide:github" height={18} />}
          onClick={() => setGithubModalOpen(true)}
        >
          Repository
        </Menu.Item>
        <Menu.Item
          disabled={isUploading}
          leftSection={<Icon icon="lucide:screen-share" height={18} />}
          onClick={() => void captureScreenshot()}
        >
          Screenshot
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  const rightActionContent = (
    <>
      <Popover position="top" transitionProps={{ transition: 'fade-up' }}>
        <PopoverTarget>
          <Button fw="normal" bg="var(--tc-surface)" c="var(--mantine-color-text)" maw="25vw">
            {config?.model}
          </Button>
        </PopoverTarget>
        <PopoverDropdown maw={250}>
          <ModelSelect
            flex={1}
            variant="filled"
            comboboxProps={{
              withinPortal: false,
              transitionProps: { transition: 'fade-up' },
              offset: 0,
            }}
            styles={{
              dropdown: {
                boxShadow: shadow,
              },
            }}
            configValue={config}
            onConfigChange={(value) => {
              setConfig(value!);
              updateSavedConfig(JSON.stringify(value));
            }}
            feature={'generate'}
          />
          {!!args?.length && <Divider my="xs" />}
          <Stack gap="xs">
            {args?.map((arg) => (
              <Box key={arg.name}>
                {arg.type === 'list' && (
                  <>
                    <Text size="xs" mb={2}>
                      {arg.name}
                    </Text>
                    <Select
                      key={arg.name}
                      comboboxProps={{ withinPortal: false, offset: 0 }}
                      data={arg.values}
                      size="xs"
                      value={
                        (config?.args as Record<string, string> | undefined)?.[arg.name] ??
                        arg.default
                      }
                      onChange={(value) => setArg(arg.name, value)}
                    />
                  </>
                )}
                {arg.type === 'range' && (
                  <>
                    <Text size="xs" mb={2}>
                      {arg.name}
                    </Text>
                    <Slider
                      min={arg.min}
                      max={arg.max}
                      step={arg.step}
                      value={
                        (config?.args as Record<string, number> | undefined)?.[arg.name] ??
                        arg.default
                      }
                      onChange={(value) => setArg(arg.name, value)}
                    />
                  </>
                )}
              </Box>
            ))}
          </Stack>
        </PopoverDropdown>
      </Popover>
      <ActionIcon
        variant="subtle"
        size={32}
        onClick={abortController !== null ? () => abortController.abort() : onSend}
        disabled={
          isMessagingDisabled && (abortController === null || abortController.signal.aborted)
        }
      >
        {abortController !== null ? (
          <Icon icon="lucide:square" height={18} />
        ) : (
          <Icon icon="lucide:send" height={18} />
        )}
      </ActionIcon>
    </>
  );

  const leftActions = (
    <div
      ref={leftSectionRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        opacity: isMultiline ? 0 : 1,
        pointerEvents: isMultiline ? 'none' : 'auto',
        transition: 'opacity 200ms ease',
      }}
    >
      {leftActionContent}
    </div>
  );

  const rightActions = (
    <div
      ref={rightSectionRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        opacity: isMultiline ? 0 : 1,
        pointerEvents: isMultiline ? 'none' : 'auto',
        transition: 'opacity 200ms ease',
      }}
    >
      {rightActionContent}
    </div>
  );

  return (
    <>
      <GitHub opened={githubModalOpen} onClose={() => setGithubModalOpen(false)} />
      <InputWrapper {...props}>
        <InputBase
          component="div"
          multiline
          pointer
          disabled={isMessagingDisabled}
          leftSection={leftActions}
          rightSection={rightActions}
          style={{
            '--input-left-section-width': 'auto',
            '--input-right-section-width': 'auto',
          }}
          radius={(props.style as CSSProperties)?.borderRadius ?? 0}
          styles={{
            input: {
              padding: 0,
              wordBreak: 'break-word',
              zIndex: 'var(--tc-surface)',
            },
            section: {
              display: 'flex',
              alignItems: 'center',
              margin: '5px',
              pointerEvents: 'none',
            },
          }}
        >
          <ScrollAreaAutosize
            ref={scrollRef}
            type="auto"
            mah={200}
            scrollbarSize={6}
            style={{
              paddingLeft: (!isMultiline ? sectionWidths.left : 0) + 10,
              paddingRight: (!isMultiline ? sectionWidths.right : 0) + 10,
              paddingTop: 5,
              paddingBottom: 5,
              minHeight: 'var(--input-height)',
              cursor: isMessagingDisabled ? 'not-allowed' : 'text',
              transition: 'padding-left 200ms ease, padding-right 200ms ease',
            }}
            onClick={() => ReactEditor.focus(editor)}
          >
            <Slate
              editor={editor}
              initialValue={[{ type: 'paragraph', children: [{ text: '' }] }]}
              onValueChange={resetMultiline}
            >
              <Editable
                renderElement={useCallback((props: RenderElementProps) => renderElement(props), [])} // TODO - eskms - ughhhhhhh
                renderLeaf={useCallback((props: RenderLeafProps) => renderLeaf(props), [])}
                decorate={useCallback((entry: NodeEntry) => decorate(entry), [])}
                onKeyDown={onKeyDown}
                onFocus={() => setIsMessaging(true)}
                onBlur={() => setIsMessaging(false)}
                readOnly={isMessagingDisabled}
                autoCapitalize="sentences"
              ></Editable>
            </Slate>
          </ScrollAreaAutosize>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: isMultiline ? '0 5px 5px 5px' : '0 5px 0 5px',
              maxHeight: isMultiline ? 50 : 0,
              opacity: isMultiline ? 1 : 0,
              overflow: 'hidden',
              pointerEvents: isMultiline ? 'auto' : 'none',
              transition: 'max-height 200ms ease, opacity 200ms ease, padding-bottom 200ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>{leftActionContent}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {rightActionContent}
            </div>
          </div>
        </InputBase>
      </InputWrapper>
    </>
  );
}
