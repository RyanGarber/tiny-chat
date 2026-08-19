import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Box,
	Button,
	Popover,
	PopoverDropdown,
	PopoverTarget,
	Select,
	Slider,
	Stack,
	Text,
} from "@mantine/core";
import { useConfig } from "@tiny-chat/client/src/features/agent/hooks/useConfig.ts";
import { useSkills } from "@tiny-chat/client/src/features/agent/hooks/useSkills.ts";
import { useTools } from "@tiny-chat/client/src/features/agent/hooks/useTools.ts";
import { ClientAgentService } from "@tiny-chat/client/src/features/agent/services/ClientAgentService.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { useMessaging } from "@tiny-chat/client/src/features/chat/hooks/useMessaging.ts";
import { StreamService } from "@tiny-chat/client/src/features/chat/services/StreamService.ts";
import { ToolUtils } from "@tiny-chat/core/src/features/tool/utils/ToolUtils.ts";
import { useMemo } from "react";
import { client } from "#app/client.ts";
import ModelSelect from "#app/core/components/ModelSelect.tsx";
import { AppService } from "#app/core/services/AppService.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import TokenUsage from "#app/features/editor/components/TokenUsage.tsx";
import { useEditorStore } from "#app/features/editor/stores/useEditorStore.ts";

export default function RightSection({ isAny }: { isAny: boolean }) {
	const { chat } = useChat();
	const { sendMessage } = useMessaging();
	const { config, setConfig, modelArgs, setModelArg } = useConfig();

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

	const stream = StreamService.getChat(chat.data?.id ?? "");
	const isEmpty = useEditorStore((state) => state.isEmpty);
	const isIncomplete = useEditorStore((state) => state.isIncomplete);

	return (
		<>
			<TokenUsage />
			<Popover position="top" transitionProps={{ transition: "fade-up" }}>
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
				<PopoverDropdown maw={400} style={{ boxShadow: StyleUtils.shadow }}>
					<ModelSelect
						flex={1}
						variant="subtle"
						comboboxProps={{
							withinPortal: false,
							transitionProps: { transition: "fade-down" },
							offset: 0,
						}}
						styles={{
							dropdown: {
								boxShadow: StyleUtils.shadow,
							},
						}}
						configValue={config}
						onConfigChange={(value) => value && setConfig(value)}
						feature="language"
						disabled={isAny}
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
										variant="unstyled"
										styles={{
											input: {
												padding: "0 10px",
											},
											dropdown: {
												boxShadow: StyleUtils.shadow,
											},
										}}
										comboboxProps={{
											withinPortal: false,
											offset: 0,
											position: "top",
											transitionProps: { transition: "fade-up" },
										}}
										onChange={(value) => setModelArg(arg.name, value)}
										disabled={isAny}
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
										disabled={isAny}
									/>
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
					if (stream) void ClientAgentService.abort({ client, id: stream.id });
					else sendMessage.mutate();
				}}
				loading={sendMessage.isPending}
				disabled={
					(isEmpty || isIncomplete || isAny) &&
					(stream === undefined || stream.abort.signal.aborted)
				}
			>
				{stream ? (
					<Icon icon="lucide:square" height={18} />
				) : (
					<Icon icon="lucide:send" height={18} />
				)}
			</ActionIcon>
		</>
	);
}
