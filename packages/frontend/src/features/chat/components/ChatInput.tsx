import { useMessaging } from '@/stores/messaging.tsx';
import { setupEditor } from '@/slate/setup.tsx';
import { onKeyDown } from '@/slate/events.tsx';
import { decorate, renderElement, renderLeaf } from '@/slate/renderer.tsx';
import {
  ActionIcon,
  Box,
  Button,
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
import {
  CSSProperties,
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEventHandler,
  type KeyboardEvent,
} from 'react';
import { Editable, ReactEditor, RenderElementProps, RenderLeafProps, Slate } from 'slate-react';
import { serialize } from '@/slate/serializer.tsx';
import { useLayout } from '@/stores/layout.tsx';
import ModelSelect from '@/features/input/components/ModelSelect';
import { Icon } from '@iconify/react';
import { NodeEntry } from 'slate';
import Upload, {
  FileMenuItem,
  RepositoryMenuItem,
  ScreenshotMenuItem,
} from '@/features/input/components/Upload';
import { useChat } from '@/features/chat/hooks/useChat';
import { StreamService } from '@/features/message/services/StreamService';
import { glassStyle } from '@/utils/glass';
import { useConfig } from '@/features/input/hooks/useConfig';
import { CapabilitySelect } from '@/features/input/components/CapabilitySelect';
import { useTools } from '@/features/input/hooks/useTools';
import { useProviders } from '@/features/input/hooks/useProviders';
import { useSkills } from '@/features/input/hooks/useSkills';
import { useHotkeys } from '@mantine/hooks';
import { useIsMutating } from '@tanstack/react-query';
import { uploadMutationKey, useUploads } from '@/features/input/hooks/useUploads';
import { useSend } from '../hooks/useSend';
import { GenerateService } from '@/features/message/services/GenerateService';
import { precheckAllToolRequirements } from '@tiny-chat/shared/src/utils';
import { auth } from '@/utils/api';
import { useChatStore } from '../stores/useChatStore';
import { useTauri } from '@/core/hooks/useTauri';

export const ChatInput = memo(({ isAny, ...props }: InputWrapperProps & { isAny: boolean }) => {
  const session = auth.useSession();
  const activeChat = useChat();
  const { config, setConfig } = useConfig();

  const stream = StreamService.getChat(activeChat.data?.id ?? '');

  const createIncognito = useChatStore((s) => s.createIncognito);
  const setEditor = useMessaging((s) => s.setEditor);
  const { isTauriDesktop } = useTauri();

  const { providers } = useProviders();
  const { toolGroups } = useTools();

  const { skills } = useSkills();
  const enabledSkills = useMemo(
    () => skills.filter((s) => config.skills?.includes(s.name)).map((s) => s.name),
    [skills, config.skills],
  );

  const enabledTools = useMemo(
    () =>
      precheckAllToolRequirements(
        toolGroups,
        session.data?.user,
        activeChat.data,
        createIncognito,
        true,
        isTauriDesktop.data,
        providers.data,
        skills,
      )
        .filter((g) => config.toolGroups?.includes(g.name))
        .flatMap((g) => g.tools),
    [
      toolGroups,
      config.toolGroups,
      session.data?.user,
      activeChat.data,
      createIncognito,
      isTauriDesktop.data,
      providers.data,
      skills,
    ],
  );

  const shadow = useLayout((s) => s.shadow);

  const [isMultiline, setMultiline] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'repo'>('file');
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

  const args = useMemo(() => {
    return (
      providers.data?.chat
        .find((s) => s.name === config.provider)
        ?.models.find((m) => m.name === config.model)?.args ?? []
    );
  }, [config.provider, config.model, providers.data]);

  const setArg = useCallback(
    (name: string, value: unknown) => {
      if (!config) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const newConfig = { ...config, args: { ...config.args, [name]: value } };
      setConfig(newConfig);
    },
    [config, setConfig],
  );

  const [isEmpty, setEmpty] = useState(true);
  const onValueChanged = useCallback(() => {
    setEmpty(!serialize().trim().length);
    if (serialize().length === 0) setMultiline(false);
  }, [setEmpty, setMultiline]);

  const isUploading = useIsMutating({ mutationKey: uploadMutationKey }) > 0;

  const { sendMessage } = useSend();

  const [capabilitySelectOpen, setCapabilitySelectOpen] = useState(false);

  const onCapabilitySelectClose = useCallback(() => {
    setCapabilitySelectOpen(false);
  }, [setCapabilitySelectOpen]);

  const { upload } = useUploads();
  const addUploads = useMessaging((s) => s.addUploads);

  const handlePaste = useCallback<ClipboardEventHandler<HTMLDivElement>>(
    (event) => {
      for (const item of event.clipboardData.items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            upload.mutate(
              { type: 'upload', files: [file] },
              {
                onSuccess: (data) => {
                  addUploads(...data);
                },
              },
            );
          }
        }
      }
    },
    [upload, addUploads],
  );

  useHotkeys([
    [
      '/',
      () => {
        ReactEditor.focus(editor);
      },
    ],
  ]);

  const leftActionContent = useMemo(
    () => (
      <Menu position="top-start" transitionProps={{ transition: 'fade-up' }}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="var(--mantine-color-text)"
            radius={20}
            size={40}
            disabled={isAny}
            loading={isUploading}
          >
            <Icon icon="lucide:paperclip" height={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown style={{ ...glassStyle, boxShadow: shadow }}>
          <FileMenuItem
            onClick={() => {
              setUploadTab('file');
              setUploadOpen(true);
            }}
            disabled={isAny}
          />
          <RepositoryMenuItem
            onClick={() => {
              setUploadTab('repo');
              setUploadOpen(true);
            }}
            disabled={isAny}
          />
          <ScreenshotMenuItem disabled={isAny} />
        </Menu.Dropdown>
      </Menu>
    ),
    [isAny, setUploadTab, setUploadOpen, shadow, isUploading],
  );

  const rightActionContent = useMemo(
    () => (
      <>
        <CapabilitySelect opened={capabilitySelectOpen} onClose={onCapabilitySelectClose} />
        <Popover position="top" transitionProps={{ transition: 'fade-up' }}>
          <PopoverTarget>
            <Button
              fw="normal"
              variant="subtle"
              color="var(--mantine-color-text)"
              maw="25vw"
              radius={20}
              h={40}
              px={15}
              disabled={isAny}
            >
              {config.model}
            </Button>
          </PopoverTarget>
          <PopoverDropdown maw={250} style={glassStyle}>
            <ModelSelect
              flex={1}
              variant="subtle"
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
              }}
              feature="generate"
              disabled={isAny}
            />
            <Button
              fullWidth
              variant="transparent"
              c="dimmed"
              size="xs"
              onClick={() => setCapabilitySelectOpen(true)}
            >
              {enabledTools.length} TOOL{enabledTools.length !== 1 ? 'S' : ''} &middot;{' '}
              {enabledSkills.length} SKILL{enabledSkills.length !== 1 ? 'S' : ''}
            </Button>
            <Stack gap="xs" mt={5}>
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
                          (config.args as Record<string, string> | undefined)?.[arg.name] ??
                          arg.default
                        }
                        variant="unstyled"
                        onChange={(value) => setArg(arg.name, value)}
                        disabled={isAny}
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
                          (config.args as Record<string, number> | undefined)?.[arg.name] ??
                          arg.default
                        }
                        onChange={(value) => setArg(arg.name, value)}
                        disabled={isAny}
                      />
                    </>
                  )}
                </Box>
              ))}
            </Stack>
          </PopoverDropdown>
        </Popover>
        <ActionIcon
          variant="filled"
          size={40}
          radius={20}
          onClick={() => {
            if (stream) GenerateService.abort(stream.id);
            else sendMessage.mutate();
          }}
          loading={sendMessage.isPending}
          disabled={(isEmpty || isAny) && (stream === undefined || stream.abort.signal.aborted)}
        >
          {stream ? (
            <Icon icon="lucide:square" height={18} />
          ) : (
            <Icon icon="lucide:send" height={18} />
          )}
        </ActionIcon>
      </>
    ),
    [
      capabilitySelectOpen,
      onCapabilitySelectClose,
      isAny,
      config,
      shadow,
      enabledTools.length,
      enabledSkills.length,
      args,
      setArg,
      setConfig,
      stream,
      isEmpty,
      sendMessage,
    ],
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
      <Upload
        opened={uploadOpen}
        onClose={() => setUploadOpen(false)}
        tab={uploadTab}
        onTabChange={setUploadTab}
      />
      <InputWrapper {...props}>
        <style>
          {`
          .chat-input {
            position: relative;
          }
          .chat-input::after {
            position: absolute;
            content: "";
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            box-shadow: ${shadow};
            border-radius: ${(props.style as CSSProperties)?.borderRadius ?? 0}px;
            z-index: 10000;
            pointer-events: none;
          }
        `}
        </style>
        <InputBase
          className="chat-input"
          component="div"
          multiline
          pointer
          disabled={isAny}
          leftSection={leftActions}
          rightSection={rightActions}
          style={{
            '--input-left-section-width': 'auto',
            '--input-right-section-width': 'auto',
          }}
          radius={(props.style as CSSProperties)?.borderRadius ?? 0}
          styles={{
            input: {
              padding: 5,
              wordBreak: 'break-word',
              ...glassStyle,
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
              cursor: isAny ? 'not-allowed' : 'text',
              transition: 'padding-left 200ms ease, padding-right 200ms ease',
            }}
            onClick={() => ReactEditor.focus(editor)}
          >
            <Slate
              editor={editor}
              initialValue={[{ type: 'paragraph', children: [{ text: '' }] }]}
              onValueChange={onValueChanged}
            >
              <Editable
                renderElement={useCallback((props: RenderElementProps) => renderElement(props), [])}
                renderLeaf={useCallback((props: RenderLeafProps) => renderLeaf(props), [])}
                decorate={useCallback((entry: NodeEntry) => decorate(entry), [])}
                onKeyDown={useCallback(
                  (event: KeyboardEvent) => onKeyDown(event, sendMessage),
                  [sendMessage],
                )}
                onPaste={handlePaste}
                readOnly={isAny}
                autoCapitalize="sentences"
              ></Editable>
            </Slate>
          </ScrollAreaAutosize>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
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
});
