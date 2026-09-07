import {
	ActionIcon,
	Box,
	Button,
	type DefaultMantineColor,
	Popover,
	Select,
	Slider,
	Stack,
	Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { GearIcon, PaperPlaneTiltIcon, StopIcon } from "@phosphor-icons/react";
import { AgentStreamService } from "@tiny-chat/client/src/core/services/StreamService.ts";
import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useSkills } from "@tiny-chat/client/src/features/agent/hooks/useSkills.ts";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { useStreamStore } from "@tiny-chat/client/src/features/agent/stores/useStreamStore.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { useDraftStore } from "@tiny-chat/client/src/features/chat/stores/useDraftStore.ts";
import type {
	Categories,
	Usage,
} from "@tiny-chat/client/src/features/editor/hooks/useEstimatedTokens.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { useEffect, useMemo } from "react";
import ModelSelect from "#app/core/components/ModelSelect.tsx";
import { AppService } from "#app/core/services/AppService.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import TokenUsage from "#app/features/editor/components/TokenUsage.tsx";
import { useEditorStore } from "#app/features/editor/stores/useEditorStore.ts";

export default function RightSection({
	width,
	disabled,
	usage,
	categories,
}: {
	width: number;
	disabled: boolean;
	usage: Usage<DefaultMantineColor>;
	categories: Categories;
}) {
	const { chat } = useChat();
	const { sendMessage } = useMessaging();
	const { config, setConfig, modelArgs, setModelArg } = useConfig();
	const currentModal = useAppStore((state) => state.currentModal);

	const { toolsets } = useTools();
	const enabledTools = useMemo(
		() => ToolUtils.checkAll({ toolsets, config }).tools,
		[toolsets, config],
	);

	const { skills } = useSkills();
	const enabledSkills = useMemo(
		() =>
			skills.filter((s) => config.skills?.includes(s.path)).map((s) => s.name),
		[skills, config.skills],
	);

	const stream = useStreamStore((state) =>
		state.chatAgentStreams.get(chat.data?.id ?? ""),
	);

	const [opened, { toggle, close }] = useDisclosure();

	const isEmpty = useDraftStore((state) => state.isEmpty);
	const isIncomplete = useEditorStore((state) => state.isIncomplete);

	const modelWidth = width * 0.25;

	useEffect(() => {
		const onClickOutside = (event: PointerEvent) => {
			if (!opened) return;
			if (event.target instanceof HTMLElement) {
				const isRightSection = event.target.closest(".right-section");
				if (!isRightSection && !currentModal) {
					close();
				}
				event.preventDefault();
				event.stopPropagation();
			}
		};
		document.body.addEventListener("click", onClickOutside);
		return () => document.body.removeEventListener("click", onClickOutside);
	}, [currentModal, opened, close]);

	return (
		<>
			<TokenUsage usage={usage} categories={categories} />
			<Popover position="top" opened={opened}>
				<Popover.Target>
					{modelWidth < 100 ? (
						<ActionIcon
							variant="subtle"
							radius={25}
							h={30}
							w={30}
							disabled={disabled}
							color="var(--mantine-color-dimmed)"
							onClick={toggle}
							className="right-section"
						>
							<GearIcon size={20} />
						</ActionIcon>
					) : (
						<Button
							fw="normal"
							variant="subtle"
							radius={20}
							h={40}
							px={15}
							disabled={disabled}
							color="var(--mantine-color-dimmed)"
							onClick={toggle}
							className="right-section"
						>
							<Text size="sm" truncate="start" maw={modelWidth}>
								{config.model}
							</Text>
						</Button>
					)}
				</Popover.Target>
				<Popover.Dropdown maw={400} className="right-section">
					<ModelSelect
						flex={1}
						variant="subtle"
						comboboxProps={{
							offset: 0,
						}}
						classNames={{
							dropdown: "right-section",
						}}
						configValue={config}
						onConfigChange={(value) => value && setConfig(value)}
						feature="language"
						disabled={disabled}
					/>
					<Button
						fullWidth
						variant="transparent"
						c="dimmed"
						size="xs"
						onClick={() => AppService.openCapabilities()}
					>
						{enabledTools.length} TOOL{enabledTools.length !== 1 ? "S" : ""}{" "}
						&middot; {enabledSkills.length} SKILL
						{enabledSkills.length !== 1 ? "S" : ""}
					</Button>
					<Stack gap="xs" mt={5}>
						{modelArgs?.map((arg) => (
							<Box key={arg.name}>
								<Text size="xs" mb={2} c="dimmed">
									{arg.name}
								</Text>
								{arg.type === "list" && (
									<Select
										key={arg.name}
										data={arg.values}
										size="xs"
										value={
											(config.args as Record<string, string> | undefined)?.[
												arg.name
											] ?? arg.default
										}
										comboboxProps={{
											offset: 0,
											position: "top",
										}}
										onChange={(value) => setModelArg(arg.name, value)}
										disabled={disabled}
										classNames={{
											dropdown: "right-section",
										}}
									/>
								)}
								{arg.type === "range" && (
									<Slider
										min={arg.min}
										max={arg.max}
										step={(arg.max - arg.min) / 50}
										value={
											(config.args as Record<string, number> | undefined)?.[
												arg.name
											] ?? arg.default
										}
										onChange={(value) => setModelArg(arg.name, value)}
										disabled={disabled}
									/>
								)}
							</Box>
						))}
					</Stack>
				</Popover.Dropdown>
			</Popover>
			<ActionIcon
				variant="filled"
				size={40}
				radius={20}
				onClick={() => {
					if (chat.data && stream && isEmpty) AgentStreamService.abort(stream);
					else sendMessage.mutate();
				}}
				loading={sendMessage.isPending}
				disabled={
					stream && isEmpty ? false : isEmpty || isIncomplete || disabled
				}
			>
				{stream && isEmpty ? (
					<StopIcon size={20} />
				) : (
					<PaperPlaneTiltIcon size={20} />
				)}
			</ActionIcon>
		</>
	);
}
