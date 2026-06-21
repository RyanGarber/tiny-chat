import {
  ActionIcon,
  Box,
  Checkbox,
  Group,
  JsonInput,
  Modal,
  ScrollArea,
  Space,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { zMCPServers } from '@tiny-chat/shared/src/types/user';
import { useConfig } from '../hooks/useConfig';
import { useMcpServerSettings } from '@/features/settings/hooks/useMcpServerSettings';
import { mcpToolsQueryKey, useTools } from '../hooks/useTools';
import { useIsFetching } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { localSkillFilesQueryKey, useSkills } from '../hooks/useSkills';
import Dropzone from '@/features/input/components/Dropzone';
import type { zTool, zToolGroup } from '@tiny-chat/shared/src/types/tool.ts';
import type { zSkill } from '@tiny-chat/shared/src/types/skill.ts';
import { useTauri } from '@/core/hooks/useTauri';
import { precheckAllToolRequirements, scrubText } from '@tiny-chat/shared/src/utils';
import { useProviders } from '../hooks/useProviders';
import { useChatStore } from '@/features/chat/stores/useChatStore';
import { auth } from '@/utils/api';
import { useChat } from '@/features/chat/hooks/useChat';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { ZodError } from 'zod';
import { fromChatUri } from '@tiny-chat/shared/src/utils/files.ts';
import { GLASS_STYLE } from '@/utils/theme.ts';

export const CapabilitySelect = memo(
  ({ opened, onClose }: { opened: boolean; onClose: () => void }) => {
    const { config, setConfig } = useConfig();
    const { isMobile } = useLayoutStore();
    const { mcpServerSettingsUnparsed, setMcpServerSettings } = useMcpServerSettings();
    const { builtInTools, mcpTools } = useTools();
    const { localSkills, remoteSkills, deleteRemoteSkill, skills } = useSkills();

    const areMcpToolsUpdating = useIsFetching({ queryKey: mcpToolsQueryKey }) > 0;
    const areLocalSkillsUpdating = useIsFetching({ queryKey: localSkillFilesQueryKey }) > 0;

    const [mcpInputActive, setMcpInputActive] = useState(false);
    const [mcpInputError, setMcpInputError] = useState<string | null>(null);

    const session = auth.useSession();
    const { isTauriDesktop } = useTauri();
    const { chat } = useChat();
    const createIncognito = useChatStore((s) => s.createIncognito);
    const incognito = chat.data?.incognito ?? createIncognito;

    const { providers } = useProviders();
    const builtInToolsSupported = useMemo(() => {
      return precheckAllToolRequirements(
        builtInTools.data,
        session.data?.user,
        chat.data,
        incognito,
        true,
        isTauriDesktop.data,
        providers.data,
        skills,
      );
    }, [
      builtInTools.data,
      session.data?.user,
      chat.data,
      incognito,
      isTauriDesktop.data,
      providers.data,
      skills,
    ]);

    const isBuiltInToolSupported = useCallback(
      (toolGroup: zToolGroup, tool?: zTool) => {
        return builtInToolsSupported.some(
          (g) => g.name === toolGroup.name && (!tool || g.tools.some((t) => t.name === tool.name)),
        );
      },
      [builtInToolsSupported],
    );

    const Skill = ({ skill }: { skill: zSkill }) => {
      return (
        <Checkbox.Card
          p="xs"
          checked={config.skills?.includes(skill.name)}
          disabled={!skill.name}
          onClick={() => {
            setConfig({
              ...config,
              skills: !config.skills?.includes(skill.name)
                ? [...config.skills, skill.name]
                : config.skills?.filter((cs) => cs !== skill.name),
            });
          }}
          style={{ ...GLASS_STYLE }}
        >
          <Group wrap="nowrap" align="flex-start">
            <Checkbox.Indicator />
            <Stack gap={5} miw={0}>
              <Text size="xs">{skill.name}</Text>
              <Text
                size="xs"
                c="dimmed"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {scrubText(skill.description)}
              </Text>
              {config.skills?.includes(skill.name) && !config.toolGroups?.includes('files') && (
                <Group gap="xs" c="yellow">
                  <Icon icon="lucide:alert-triangle" width={12} />
                  <Text size="xs">
                    Missing tools: <span style={{ fontWeight: 450 }}>read_file</span>
                  </Text>
                </Group>
              )}
            </Stack>
          </Group>
        </Checkbox.Card>
      );
    };

    const [mcpInputValue, setMcpInputValue] = useState<string>('[]');
    useEffect(() => {
      if (!mcpInputActive && !mcpInputError && !setMcpServerSettings.isPending) {
        setMcpInputValue(
          `mcp.json (${JSON.stringify(mcpServerSettingsUnparsed.data ?? [], null, 2).split('\n').length} lines)`,
        );
      } else {
        setMcpInputValue(JSON.stringify(mcpServerSettingsUnparsed.data ?? [], null, 2) ?? '[]');
      }
    }, [
      mcpInputActive,
      mcpInputError,
      setMcpServerSettings.isPending,
      mcpServerSettingsUnparsed.data,
    ]);

    const [mcpInputValueOverride, setMcpInputValueOverride] = useState<string | null>(null);
    useLayoutEffect(() => {
      if (!mcpInputActive && !mcpInputError && !setMcpServerSettings.isPending) {
        setMcpInputValueOverride(null);
      }
    }, [mcpInputActive, mcpInputError, setMcpServerSettings.isPending]);

    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title="Tools & Skills"
        zIndex={1000}
        size="lg"
        styles={{ content: { ...GLASS_STYLE } }}
        centered
      >
        <Tabs defaultValue="tools:built-in" variant="pills">
          <Tabs.List mb="md">
            <Group gap={10}>
              <Group gap={7} mr={10}>
                <Box c="dimmed">
                  <Icon icon="lucide:wrench" width={14} />
                </Box>
                <Tabs.Tab value="tools:built-in">Native</Tabs.Tab>
                <Tabs.Tab value="tools:mcp">MCP</Tabs.Tab>
              </Group>
              <Group gap={7}>
                <Box c="dimmed">
                  <Icon icon="lucide:graduation-cap" width={14} />
                </Box>
                <Tabs.Tab value="skills:built-in">Native</Tabs.Tab>
                {(isTauriDesktop.data ?? !isMobile) && (
                  <Tabs.Tab value="skills:this-pc" disabled={!isTauriDesktop.data}>
                    This PC
                  </Tabs.Tab>
                )}
              </Group>
            </Group>
          </Tabs.List>
          <Tabs.Panel value="tools:built-in">
            <ScrollArea type="auto" offsetScrollbars h={400}>
              <Stack gap="xs">
                {builtInTools.data?.map((toolGroup, i) => (
                  <Checkbox.Card
                    key={i}
                    p="xs"
                    checked={
                      isBuiltInToolSupported(toolGroup) &&
                      config.toolGroups?.includes(toolGroup.name)
                    }
                    disabled={!isBuiltInToolSupported(toolGroup)}
                    c={!isBuiltInToolSupported(toolGroup) ? 'dimmed' : undefined}
                    onClick={() => {
                      setConfig({
                        ...config,
                        toolGroups: !config.toolGroups.includes(toolGroup.name)
                          ? [...config.toolGroups, toolGroup.name]
                          : config.toolGroups.filter((t) => t !== toolGroup.name),
                      });
                    }}
                    style={{
                      ...GLASS_STYLE,
                      cursor: !isBuiltInToolSupported(toolGroup) ? 'not-allowed' : undefined,
                    }}
                  >
                    <Group wrap="nowrap" align="flex-start">
                      <Checkbox.Indicator />
                      <div>
                        <Text size="xs">{toolGroup.instructions?.heading ?? 'Unknown'}</Text>
                        <Text size="xs" c="dimmed">
                          {toolGroup.tools.map((t, i) => (
                            <span key={i}>
                              {isBuiltInToolSupported(toolGroup, t) ? (
                                t.name + (i < toolGroup.tools.length - 1 ? ', ' : '')
                              ) : (
                                <span style={{ opacity: 0.5 }}>
                                  {t.name + (i < toolGroup.tools.length - 1 ? ', ' : '')}
                                </span>
                              )}
                            </span>
                          ))}
                        </Text>
                      </div>
                    </Group>
                  </Checkbox.Card>
                ))}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="tools:mcp">
            <ScrollArea type="auto" offsetScrollbars h={400}>
              <Stack gap="xs">
                <JsonInput
                  value={mcpInputValueOverride ?? mcpInputValue}
                  onChange={(value) => setMcpInputValueOverride(value)}
                  serialize={(value) => JSON.stringify(value, null, 2)}
                  deserialize={(value) => {
                    if (value.includes('mcp.json (')) return value;
                    zMCPServers.parse(JSON.parse(value));
                  }}
                  validationError={mcpInputError ?? undefined}
                  onFocus={() => setMcpInputActive(true)}
                  onBlur={(e) => {
                    setMcpInputActive(false);
                    try {
                      const mcpServers = zMCPServers.parse(JSON.parse(e.target.value));
                      setMcpInputError(null);
                      setMcpServerSettings.mutate({ mcpServers });
                    } catch (error) {
                      setMcpInputError(
                        error instanceof ZodError
                          ? error.issues.map((e) => e.message).join(', ')
                          : error instanceof Error
                            ? error.message
                            : 'Unknown error',
                      );
                      console.error(error);
                    }
                  }}
                  formatOnBlur
                  rows={1}
                  styles={{
                    input: {
                      fontFamily: 'monospace',
                      height:
                        mcpInputActive || mcpInputError || setMcpServerSettings.isPending
                          ? 300
                          : 20,
                      opacity:
                        mcpInputActive || mcpInputError || setMcpServerSettings.isPending ? 1 : 0.5,
                      transition: 'height 200ms ease, opacity 200ms ease',
                      cursor:
                        setMcpServerSettings.isPending || areMcpToolsUpdating
                          ? 'not-allowed'
                          : !mcpInputActive && !mcpInputError
                            ? 'pointer'
                            : undefined,
                    },
                  }}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={setMcpServerSettings.isPending || areMcpToolsUpdating}
                  readOnly={setMcpServerSettings.isPending || areMcpToolsUpdating}
                  rightSection={
                    <ActionIcon
                      variant="transparent"
                      loading={areMcpToolsUpdating}
                      onClick={() => void mcpTools.refetch()}
                    >
                      <Icon icon="lucide:refresh-cw" />
                    </ActionIcon>
                  }
                />
                {mcpTools.data?.map((mcpServer, i) => (
                  <Checkbox.Card
                    key={i}
                    p="xs"
                    checked={config.toolGroups?.includes(mcpServer.toolGroup.name)}
                    onClick={() => {
                      setConfig({
                        ...config,
                        toolGroups: !config.toolGroups?.includes(mcpServer.toolGroup.name)
                          ? [...config.toolGroups, mcpServer.toolGroup.name]
                          : config.toolGroups?.filter((t) => t !== mcpServer.toolGroup.name),
                      });
                    }}
                    style={{
                      ...GLASS_STYLE,
                      cursor: mcpServer.error !== undefined ? 'not-allowed' : undefined,
                    }}
                    disabled={mcpServer.error !== undefined}
                  >
                    <Group wrap="nowrap" align="flex-start">
                      <Checkbox.Indicator />
                      <Stack gap={5} miw={0}>
                        <Text size="xs">{mcpServer.server.name}</Text>
                        <Text size="xs" c="dimmed">
                          {mcpServer.toolGroup.tools.map((t) => t.name).join(', ')}
                        </Text>
                        {mcpServer.error !== undefined && (
                          <Group gap="xs" c="red">
                            <Icon icon="lucide:alert-circle" width={12} />
                            <Text size="xs">
                              {mcpServer.error instanceof Error
                                ? mcpServer.error.message
                                : 'Unknown error'}
                            </Text>
                          </Group>
                        )}
                      </Stack>
                      <div>
                        <Text size="xs"></Text>
                      </div>
                    </Group>
                  </Checkbox.Card>
                ))}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="skills:built-in">
            <Dropzone
              type="SKILL"
              accept={{ 'application/zip': ['.zip'], 'text/markdown': ['.md'] }}
              options={{ onSuccess: () => void remoteSkills.refetch() }}
            />
            <Space h="md" />
            <ScrollArea type="auto" offsetScrollbars h={280}>
              <Stack gap="xs">
                {remoteSkills.data?.map((s, i) => (
                  <Group key={i}>
                    <Box flex={1} miw={0}>
                      <Skill skill={s} />
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      loading={
                        deleteRemoteSkill.isPending &&
                        deleteRemoteSkill.variables.id === fromChatUri(s.path)!.uploadId
                      }
                      disabled={
                        deleteRemoteSkill.isPending &&
                        deleteRemoteSkill.variables.id === fromChatUri(s.path)!.uploadId
                      }
                      onClick={() =>
                        deleteRemoteSkill.mutate({ id: fromChatUri(s.path)!.uploadId! })
                      }
                    >
                      <Icon icon="lucide:trash" />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="skills:this-pc">
            <ScrollArea type="auto" offsetScrollbars h={400}>
              <Stack gap="xs">
                <TextInput
                  placeholder="~/.agent/skills"
                  disabled
                  readOnly
                  styles={{
                    input: {
                      fontFamily: 'monospace',
                      fontSize: 12.5,
                      paddingBottom: 3,
                    },
                  }}
                  rightSection={
                    <ActionIcon
                      variant="transparent"
                      loading={areLocalSkillsUpdating}
                      onClick={() => void localSkills.refetch()}
                    >
                      <Icon icon="lucide:refresh-cw" />
                    </ActionIcon>
                  }
                />
                {localSkills.data?.map((s, i) => (
                  <Skill key={i} skill={s} />
                ))}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>
        </Tabs>
      </Modal>
    );
  },
);
