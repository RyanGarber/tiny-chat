import { Icon } from "@iconify/react";
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
} from "@mantine/core";
import { useIsFetching } from "@tanstack/react-query";
import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import {
	type McpToolset,
	mcpToolsQueryKey,
	useTools,
} from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { useMcpServerSettings } from "@tiny-chat/client/src/features/settings/hooks/useMcpServerSettings.ts";
import { read_file } from "@tiny-chat/core/src/features/tool/tools/shell/read_file.ts";
import { memo, useEffect, useLayoutEffect, useState } from "react";
import { ZodError } from "zod";
import {
	localSkillsQueryKey,
	useSkills,
} from "#client/src/features/agent/hooks/useSkills.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import { zMCPServers } from "#core/features/data/types/user.ts";
import { DataUtils } from "#core/features/data/utils/DataUtils.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";
import type { zSkill } from "#core/features/skill/types/skill.ts";
import type { Toolset } from "#core/features/tool/types/tool.ts";
import { ToolUtils } from "#core/features/tool/utils/ToolUtils.ts";
import { useLayoutStore } from "#ui/core/stores/useLayoutStore.tsx";
import { StyleUtils } from "#ui/core/utils/StyleUtils.ts";
import type { CapabilitySelectTab } from "#ui/features/agent/stores/useCapabilitySelectStore.ts";
import { useTauri } from "#ui/features/tauri/hooks/useTauri.ts";
import Dropzone from "#ui/features/upload/components/Dropzone.tsx";

const CHAT_FILE_TOOLSET = "chat_system";
const USER_FILE_TOOLSET = "user_system";

export const CapabilitySelect = memo(
	({
		opened,
		onClose,
		defaultTab = "tools:built-in",
	}: {
		opened: boolean;
		onClose: () => void;
		defaultTab?: CapabilitySelectTab;
	}) => {
		const { config, setConfig } = useConfig();
		const { isMobile } = useLayoutStore();
		const { mcpServerSettingsUnparsed, setMcpServerSettings } =
			useMcpServerSettings();
		const { nativeTools, mcpTools } = useTools();
		const { localSkills, nativeSkills, deleteNativeSkill } = useSkills();

		const areMcpToolsUpdating =
			useIsFetching({ queryKey: mcpToolsQueryKey }) > 0;
		const areLocalSkillsUpdating =
			useIsFetching({ queryKey: localSkillsQueryKey }) > 0;

		const [mcpInputActive, setMcpInputActive] = useState(false);
		const [mcpInputError, setMcpInputError] = useState<string | null>(null);

		const { isTauriDesktop } = useTauri();

		const [mcpInputValue, setMcpInputValue] = useState<string>("[]");
		useEffect(() => {
			if (
				!mcpInputActive &&
				!mcpInputError &&
				!setMcpServerSettings.isPending
			) {
				setMcpInputValue(
					`mcp.json (${JSON.stringify(mcpServerSettingsUnparsed.data ?? [], null, 2).split("\n").length} lines)`,
				);
			} else {
				setMcpInputValue(
					JSON.stringify(mcpServerSettingsUnparsed.data ?? [], null, 2) ?? "[]",
				);
			}
		}, [
			mcpInputActive,
			mcpInputError,
			setMcpServerSettings.isPending,
			mcpServerSettingsUnparsed.data,
		]);

		const [mcpInputValueOverride, setMcpInputValueOverride] = useState<
			string | null
		>(null);
		useLayoutEffect(() => {
			if (
				!mcpInputActive &&
				!mcpInputError &&
				!setMcpServerSettings.isPending
			) {
				setMcpInputValueOverride(null);
			}
		}, [mcpInputActive, mcpInputError, setMcpServerSettings.isPending]);

		const SkillView = ({
			skills,
			native,
		}: {
			skills: zSkill[];
			native?: boolean;
		}) => {
			return skills.map((skill) => (
				<Group key={skill.name + skill.path}>
					<Box flex={1} miw={0}>
						<Checkbox.Card
							p="xs"
							checked={config.skills?.includes(skill.path)}
							disabled={!skill.name}
							onClick={() => {
								setConfig({
									...config,
									skills: !config.skills?.includes(skill.path)
										? [...config.skills, skill.path]
										: config.skills?.filter((cs) => cs !== skill.path),
								});
							}}
							style={{ ...StyleUtils.glass }}
						>
							<Group wrap="nowrap" align="flex-start">
								<Checkbox.Indicator />
								<Stack gap={5} miw={0}>
									<Text size="xs">{skill.name}</Text>
									<Text
										size="xs"
										c="dimmed"
										style={{
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{DataUtils.getTextCleaned({ data: skill.description })}
									</Text>
									{config.skills?.includes(skill.path) &&
										!config.toolsets?.includes(
											PathUtils.fromMount(skill)
												? CHAT_FILE_TOOLSET
												: USER_FILE_TOOLSET,
										) && (
											<Group gap="xs" c="yellow">
												<Icon icon="lucide:alert-triangle" width={12} />
												<Text size="xs">
													Missing tools:{" "}
													<span style={{ fontWeight: 450 }}>
														{read_file.name}
													</span>
												</Text>
											</Group>
										)}
								</Stack>
							</Group>
						</Checkbox.Card>
					</Box>
					{native && (
						<ActionIcon
							variant="subtle"
							color="red"
							loading={
								deleteNativeSkill.isPending &&
								deleteNativeSkill.variables.id ===
									(PathUtils.fromMountOrThrow(skill).uploadId as string)
							}
							disabled={
								deleteNativeSkill.isPending &&
								deleteNativeSkill.variables.id ===
									(PathUtils.fromMountOrThrow(skill).uploadId as string)
							}
							onClick={() =>
								deleteNativeSkill.mutate({
									id: PathUtils.fromMountOrThrow(skill).uploadId as string,
								})
							}
						>
							<Icon icon="lucide:trash" />
						</ActionIcon>
					)}
				</Group>
			));
		};

		const ToolsetView = ({
			toolsets,
		}: {
			toolsets: McpToolset[] | Toolset<any>[];
		}) => {
			return toolsets.map((toolset) => {
				const toolsetName = ToolUtils.name({ toolset });
				const toolNames = toolset.tools.map((tool) =>
					ToolUtils.name({ toolset, tool }),
				);

				return (
					<Checkbox.Card
						key={toolsetName}
						p="xs"
						checked={ToolUtils.checkOne({ toolset, config })}
						onClick={() => {
							setConfig({
								...config,
								toolsets: !config.toolsets.includes(toolsetName)
									? [...config.toolsets, toolsetName]
									: config.toolsets.filter((name) => name !== toolsetName),
							});
						}}
						style={{
							...StyleUtils.glass,
							cursor: !toolset.status.valid ? "not-allowed" : undefined,
						}}
						disabled={!toolset.status.valid}
						opacity={!toolset.status.valid ? 0.5 : 1}
					>
						<Group wrap="nowrap" align="flex-start">
							<Checkbox.Indicator />
							<Stack gap={5} miw={0}>
								<Text size="xs">{toolsetName}</Text>
								<Text size="xs" c="dimmed">
									{toolNames.map((toolName, i) => (
										<span key={toolName}>
											{`${toolName}${i < toolset.tools.length - 1 ? ", " : ""}`}
										</span>
									))}
								</Text>
								{!!toolset.status.error && (
									<Group gap="xs" c="red">
										<Icon icon="lucide:alert-circle" width={12} />
										<Text size="xs">
											{CommonUtils.getErrorFormatted(toolset.status)}
										</Text>
									</Group>
								)}
							</Stack>
						</Group>
					</Checkbox.Card>
				);
			});
		};

		return (
			<Modal
				opened={opened}
				onClose={onClose}
				title="Tools & Skills"
				zIndex={1000}
				size="lg"
				styles={{ content: { ...StyleUtils.glass } }}
				centered
			>
				<Tabs key={defaultTab} defaultValue={defaultTab} variant="pills">
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
									<Tabs.Tab
										value="skills:this-pc"
										disabled={!isTauriDesktop.data}
									>
										This PC
									</Tabs.Tab>
								)}
							</Group>
						</Group>
					</Tabs.List>
					<Tabs.Panel value="tools:built-in">
						<ScrollArea type="auto" offsetScrollbars h={400}>
							<Stack gap="xs">
								<ToolsetView toolsets={nativeTools.data ?? []} />
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
										if (value.includes("mcp.json (")) return value;
										zMCPServers.parse(JSON.parse(value));
									}}
									validationError={mcpInputError ?? undefined}
									onFocus={() => setMcpInputActive(true)}
									onBlur={(e) => {
										setMcpInputActive(false);
										try {
											const mcpServers = zMCPServers.parse(
												JSON.parse(e.target.value),
											);
											setMcpInputError(null);
											setMcpServerSettings.mutate({ mcpServers });
										} catch (error) {
											setMcpInputError(
												error instanceof ZodError
													? error.issues.map((e) => e.message).join(", ")
													: error instanceof Error
														? error.message
														: "Unknown error",
											);
											console.error(error);
										}
									}}
									formatOnBlur
									rows={1}
									styles={{
										input: {
											fontFamily: "monospace",
											height:
												mcpInputActive ||
												mcpInputError ||
												setMcpServerSettings.isPending
													? 300
													: 20,
											opacity:
												mcpInputActive ||
												mcpInputError ||
												setMcpServerSettings.isPending
													? 1
													: 0.5,
											transition: "height 200ms ease, opacity 200ms ease",
											cursor:
												setMcpServerSettings.isPending || areMcpToolsUpdating
													? "not-allowed"
													: !mcpInputActive && !mcpInputError
														? "pointer"
														: undefined,
										},
									}}
									autoCorrect="off"
									autoCapitalize="none"
									spellCheck={false}
									disabled={
										setMcpServerSettings.isPending || areMcpToolsUpdating
									}
									readOnly={
										setMcpServerSettings.isPending || areMcpToolsUpdating
									}
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
								<ToolsetView toolsets={mcpTools.data ?? []} />
							</Stack>
						</ScrollArea>
					</Tabs.Panel>
					<Tabs.Panel value="skills:built-in">
						<Dropzone
							type="SKILL"
							accept={{ "application/zip": [".zip"], "text/markdown": [".md"] }}
							options={{ onSuccess: () => void nativeSkills.refetch() }}
						/>
						<Space h="md" />
						<ScrollArea type="auto" offsetScrollbars h={280}>
							<Stack gap="xs">
								<SkillView skills={nativeSkills.data ?? []} native />
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
											fontFamily: "monospace",
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
								<SkillView skills={localSkills.data ?? []} />
							</Stack>
						</ScrollArea>
					</Tabs.Panel>
				</Tabs>
			</Modal>
		);
	},
);
