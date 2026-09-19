import {
	ActionIcon,
	Box,
	Button,
	Card,
	Checkbox,
	Collapse,
	Group,
	Modal,
	ScrollArea,
	SegmentedControl,
	Space,
	Stack,
	Tabs,
	TagsInput,
	Text,
	TextInput,
} from "@mantine/core";
import {
	ArrowClockwiseIcon,
	CaretDownIcon,
	CaretRightIcon,
	GraduationCapIcon,
	PlusIcon,
	TrashIcon,
	WarningCircleIcon,
	WarningDiamondIcon,
	WrenchIcon,
} from "@phosphor-icons/react";
import { useIsFetching } from "@tanstack/react-query";
import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { mcpServerQueryKey } from "@tiny-chat/client/src/features/agent/hooks/useMcp.ts";
import {
	type McpToolset,
	useTools,
} from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { useMcpServerSettings } from "@tiny-chat/client/src/features/settings/hooks/useMcpServerSettings.ts";
import { read_file } from "@tiny-chat/core/src/features/tool/tools/shell/read_file.ts";
import { useState } from "react";
import {
	type CapabilitiesType,
	useAppStore,
} from "#app/core/stores/useAppStore.ts";
import scrollable from "#app/core/styles/scrollable.module.css";
import { useTauri } from "#app/features/tauri/hooks/useTauri.ts";
import Dropzone from "#app/features/upload/components/Dropzone.tsx";
import {
	localSkillsQueryKey,
	useSkills,
} from "#client/src/features/agent/hooks/useSkills.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import type { zMCPServers } from "#core/features/data/types/user.ts";
import { DataUtils } from "#core/features/data/utils/DataUtils.ts";
import { PathUtils } from "#core/features/file/utils/PathUtils.ts";
import type { zSkill } from "#core/features/skill/types/skill.ts";
import type { Toolset } from "#core/features/tool/types/tool.ts";
import { ToolUtils } from "#core/features/tool/utils/ToolUtils.ts";

const SHELL_TOOLSET = "shell";
type McpServers = NonNullable<zMCPServers>;
type McpServerSetting = McpServers[keyof McpServers];

const getMcpToolsetName = (name: string) =>
	name.replace("-", "_").toLowerCase();

function KeyValueFields({
	label,
	value,
	onChange,
	onBlur,
	disabled,
}: {
	label: string;
	value: Record<string, string>;
	onChange: (value: Record<string, string>) => void;
	onBlur: (value: Record<string, string>) => void;
	disabled: boolean;
}) {
	const [entries, setEntries] = useState(() =>
		Object.entries(value).map(([key, entryValue]) => ({
			id: CommonUtils.getRandomId(),
			key,
			value: entryValue,
		})),
	);
	const updateEntries = (
		nextEntries: { id: string; key: string; value: string }[],
	) => {
		setEntries(nextEntries);
		onChange(toRecord(nextEntries));
	};
	const toRecord = (nextEntries = entries) =>
		Object.fromEntries(
			nextEntries
				.filter((entry) => entry.key)
				.map((entry) => [entry.key, entry.value]),
		);

	return (
		<Stack gap={5}>
			<Text size="xs" fw={500}>
				{label}
			</Text>
			{entries.map((entry) => (
				<Group key={entry.id} gap="xs" wrap="nowrap">
					<TextInput
						aria-label={`${label} key`}
						placeholder="Name"
						value={entry.key}
						onChange={(event) => {
							updateEntries(
								entries.map((candidate) =>
									candidate.id === entry.id
										? { ...candidate, key: event.currentTarget.value }
										: candidate,
								),
							);
						}}
						onBlur={() => onBlur(toRecord())}
						flex={1}
					/>
					<TextInput
						aria-label={`${label} value`}
						placeholder="Value"
						value={entry.value}
						onChange={(event) => {
							updateEntries(
								entries.map((candidate) =>
									candidate.id === entry.id
										? { ...candidate, value: event.currentTarget.value }
										: candidate,
								),
							);
						}}
						onBlur={() => onBlur(toRecord())}
						flex={1}
					/>
					<ActionIcon
						variant="subtle"
						color="red"
						disabled={disabled}
						aria-label={`Remove ${label.toLowerCase()} entry`}
						onClick={() => {
							const nextEntries = entries.filter(
								(candidate) => candidate.id !== entry.id,
							);
							updateEntries(nextEntries);
							onBlur(toRecord(nextEntries));
						}}
					>
						<TrashIcon size={16} />
					</ActionIcon>
				</Group>
			))}
			<Button
				variant="subtle"
				size="compact-xs"
				leftSection={<PlusIcon size={14} />}
				style={{ alignSelf: "flex-start" }}
				disabled={disabled}
				onClick={() =>
					updateEntries([
						...entries,
						{ id: CommonUtils.getRandomId(), key: "", value: "" },
					])
				}
			>
				Add {label.toLowerCase()}
			</Button>
		</Stack>
	);
}

function McpServerCard({
	name,
	server,
	toolset,
	disabled,
	onUpdate,
	onDelete,
	onRefresh,
}: {
	name: string;
	server: McpServerSetting;
	toolset?: McpToolset;
	disabled: boolean;
	onUpdate: (name: string, nextName: string, server: McpServerSetting) => void;
	onDelete: (name: string) => void;
	onRefresh: (name: string) => void;
}) {
	const { config, setConfig } = useConfig();
	const [expanded, setExpanded] = useState(false);
	const isConnecting =
		useIsFetching({ queryKey: [...mcpServerQueryKey, name] }) > 0;
	const [draftName, setDraftName] = useState(name);
	const [draft, setDraft] = useState(server);
	const toolsetName = getMcpToolsetName(name);
	const status = toolset?.status;

	const save = (nextDraft = draft, nextName = draftName) => {
		if (nextName !== name && config.toolsets.includes(toolsetName)) {
			setConfig({
				...config,
				toolsets: config.toolsets.map((value) =>
					value === toolsetName ? getMcpToolsetName(nextName) : value,
				),
			});
		}
		onUpdate(name, nextName, nextDraft);
	};

	return (
		<Card withBorder padding={0}>
			<Box
				role="button"
				tabIndex={0}
				p="xs"
				w="100%"
				style={{ cursor: "pointer" }}
				onClick={() => setExpanded((value) => !value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						setExpanded((value) => !value);
					}
				}}
			>
				<Group wrap="nowrap" align="flex-start">
					<Box pt={2}>
						{expanded ? (
							<CaretDownIcon size={16} />
						) : (
							<CaretRightIcon size={16} />
						)}
					</Box>
					<Checkbox
						mt={2}
						checked={toolset ? ToolUtils.checkOne({ toolset, config }) : false}
						disabled={disabled || status?.valid === false}
						onClick={(event) => event.stopPropagation()}
						onChange={() => {
							setConfig({
								...config,
								toolsets: !config.toolsets.includes(toolsetName)
									? [...config.toolsets, toolsetName]
									: config.toolsets.filter((value) => value !== toolsetName),
							});
						}}
					/>
					<Stack gap={5} miw={0} flex={1}>
						<Text size="xs">{name}</Text>
						<Text size="xs" c="dimmed">
							{isConnecting || !toolset
								? "Connecting…"
								: toolset.tools.map((tool) => tool.name).join(", ") ||
									"No tools"}
						</Text>
						{!isConnecting && !!status?.error && (
							<Group gap="xs" c="red">
								<WarningCircleIcon size={14} />
								<Text size="xs">{CommonUtils.formatError(status)}</Text>
							</Group>
						)}
					</Stack>
					<ActionIcon
						variant="transparent"
						c="dimmed"
						aria-label={`Reconnect ${name}`}
						loading={isConnecting}
						disabled={disabled}
						onClick={(event) => {
							event.stopPropagation();
							onRefresh(name);
						}}
					>
						<ArrowClockwiseIcon size={18} />
					</ActionIcon>
				</Group>
			</Box>
			<Collapse expanded={expanded}>
				<Stack px="xs" pb="xs" gap="xs">
					<TextInput
						label="Name"
						value={draftName}
						disabled={disabled}
						onChange={(event) => setDraftName(event.currentTarget.value)}
						onBlur={() => save()}
					/>
					<SegmentedControl
						fullWidth
						value={"command" in draft ? "stdio" : "http"}
						data={[
							{ label: "stdio", value: "stdio" },
							{ label: "HTTP", value: "http" },
						]}
						disabled={disabled}
						onChange={(value) => {
							setDraft(value === "stdio" ? { command: "" } : { url: "" });
						}}
					/>
					{"command" in draft ? (
						<>
							<TextInput
								label="Command"
								placeholder="npx"
								value={draft.command}
								disabled={disabled}
								onChange={(event) =>
									setDraft({ ...draft, command: event.currentTarget.value })
								}
								onBlur={() => save()}
							/>
							<TagsInput
								label="Arguments"
								placeholder="Add argument"
								value={draft.args ?? []}
								disabled={disabled}
								onChange={(args) => {
									const next = { ...draft, args };
									setDraft(next);
									save(next);
								}}
							/>
							<KeyValueFields
								label="Environment"
								value={draft.env ?? {}}
								onChange={(env) => setDraft({ ...draft, env })}
								onBlur={(env) => save({ ...draft, env })}
								disabled={disabled}
							/>
						</>
					) : (
						<>
							<TextInput
								label="URL"
								placeholder="https://example.com/mcp"
								value={draft.url}
								disabled={disabled}
								onChange={(event) =>
									setDraft({ ...draft, url: event.currentTarget.value })
								}
								onBlur={() => save()}
							/>
							<KeyValueFields
								label="Headers"
								value={draft.headers ?? {}}
								onChange={(headers) => setDraft({ ...draft, headers })}
								onBlur={(headers) => save({ ...draft, headers })}
								disabled={disabled}
							/>
						</>
					)}
					<Button
						variant="subtle"
						color="red"
						size="compact-xs"
						leftSection={<TrashIcon size={14} />}
						style={{ alignSelf: "flex-start" }}
						disabled={disabled}
						onClick={() => onDelete(name)}
					>
						Remove server
					</Button>
				</Stack>
			</Collapse>
		</Card>
	);
}

function ToolsetView({
	toolsets,
}: {
	toolsets: McpToolset[] | Toolset<any>[];
}) {
	const { config, setConfig } = useConfig();

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
								<WarningCircleIcon size={14} />
								<Text size="xs">{CommonUtils.formatError(toolset.status)}</Text>
							</Group>
						)}
					</Stack>
				</Group>
			</Checkbox.Card>
		);
	});
}

function SkillView({ skills, native }: { skills: zSkill[]; native?: boolean }) {
	const { config, setConfig } = useConfig();
	const { deleteNativeSkill } = useSkills();

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
								!config.toolsets?.includes(SHELL_TOOLSET) && (
									<Group gap={5} c="yellow">
										<WarningDiamondIcon size={14} />
										<Text size="xs">
											Needs{" "}
											<span style={{ fontWeight: 450 }}>{read_file.name}</span>
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
							(PathUtils.fromMountOrThrow(skill).id as string)
					}
					disabled={
						deleteNativeSkill.isPending &&
						deleteNativeSkill.variables.id ===
							(PathUtils.fromMountOrThrow(skill).id as string)
					}
					onClick={() =>
						deleteNativeSkill.mutate({
							id: PathUtils.fromMountOrThrow(skill).id as string,
						})
					}
				>
					<TrashIcon size={18} />
				</ActionIcon>
			)}
		</Group>
	));
}

export default function Capabilities() {
	const { isTauriDesktop } = useTauri();
	const { nativeTools, mcpTools, refreshMcpServers } = useTools();
	const { localSkills, nativeSkills } = useSkills();
	const { mcpServerSettingsUnparsed, setMcpServerSettings } =
		useMcpServerSettings();

	const isMobile = useAppStore((state) => state.isMobile);
	const currentModal = useAppStore((state) => state.currentModal);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);
	const currentCapabilities = useAppStore((state) => state.currentCapabilities);
	const setCurrentCapabilities = useAppStore(
		(state) => state.setCurrentCapabilities,
	);

	const mcpServers = mcpServerSettingsUnparsed.data ?? {};

	const areMcpServersConnecting =
		useIsFetching({ queryKey: mcpServerQueryKey }) > 0;
	const areLocalSkillsUpdating =
		useIsFetching({ queryKey: localSkillsQueryKey }) > 0;
	const mcpSettingsDisabled =
		mcpServerSettingsUnparsed.isPending || setMcpServerSettings.isPending;
	const updateMcpServers = (next: McpServers) => {
		setMcpServerSettings.mutate({ mcpServers: next });
	};

	return (
		<Modal
			opened={currentModal === "capabilities"}
			onClose={() => setCurrentModal(null)}
			title="Tools & Skills"
			zIndex={1000}
			size="lg"
			centered
			classNames={scrollable}
		>
			<Tabs
				value={currentCapabilities}
				onChange={(value) => setCurrentCapabilities(value as CapabilitiesType)}
				variant="pills"
			>
				<Tabs.List mb="md">
					<Group gap={10}>
						<Group gap={7} mr={10}>
							<Box c="dimmed">
								<WrenchIcon size={16} />
							</Box>
							<Tabs.Tab value="tools:native">Native</Tabs.Tab>
							<Tabs.Tab value="tools:mcp">MCP</Tabs.Tab>
						</Group>
						<Group gap={7}>
							<Box c="dimmed">
								<GraduationCapIcon size={16} />
							</Box>
							<Tabs.Tab value="skills:native">Native</Tabs.Tab>
							{(isTauriDesktop.data ?? !isMobile) && (
								<Tabs.Tab value="skills:local" disabled={!isTauriDesktop.data}>
									Local
								</Tabs.Tab>
							)}
						</Group>
					</Group>
				</Tabs.List>
				<Tabs.Panel value="tools:native">
					<ScrollArea type="auto" offsetScrollbars h={400}>
						<Stack gap="xs">
							<ToolsetView toolsets={nativeTools.data ?? []} />
						</Stack>
					</ScrollArea>
				</Tabs.Panel>
				<Tabs.Panel value="tools:mcp">
					<ScrollArea type="auto" offsetScrollbars h={400}>
						<Stack gap="xs">
							<Group justify="space-between">
								<Button
									variant="subtle"
									size="compact-xs"
									leftSection={<PlusIcon size={14} />}
									disabled={mcpSettingsDisabled}
									onClick={() => {
										let name = "server";
										let suffix = 2;
										while (name in mcpServers) name = `server-${suffix++}`;
										updateMcpServers({
											...mcpServers,
											[name]: { command: "" },
										});
									}}
								>
									Add server
								</Button>
								<ActionIcon
									variant="transparent"
									loading={areMcpServersConnecting}
									aria-label="Refresh MCP servers"
									onClick={() => refreshMcpServers.mutate({})}
								>
									<ArrowClockwiseIcon size={18} />
								</ActionIcon>
							</Group>
							{Object.entries(mcpServers).map(([name, server]) => (
								<McpServerCard
									key={name}
									name={name}
									server={server}
									toolset={mcpTools.data?.find(
										(toolset) => toolset.name === getMcpToolsetName(name),
									)}
									disabled={mcpSettingsDisabled}
									onUpdate={(oldName, nextName, value) => {
										const servers = { ...mcpServers };
										delete servers[oldName];
										servers[nextName] = value;
										updateMcpServers(servers);
									}}
									onDelete={(serverName) => {
										const servers = { ...mcpServers };
										delete servers[serverName];
										updateMcpServers(servers);
									}}
									onRefresh={(serverName) =>
										refreshMcpServers.mutate({ name: serverName })
									}
								/>
							))}
						</Stack>
					</ScrollArea>
				</Tabs.Panel>
				<Tabs.Panel value="skills:native">
					<Dropzone
						kind="SKILL"
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
				<Tabs.Panel value="skills:local">
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
										<ArrowClockwiseIcon size={18} />
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
}
