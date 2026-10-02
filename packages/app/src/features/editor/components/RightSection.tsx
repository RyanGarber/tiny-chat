import {
	ActionIcon,
	Button,
	type DefaultMantineColor,
	Popover,
	Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { GearIcon, PaperPlaneTiltIcon, StopIcon } from "@phosphor-icons/react";
import { AgentStreamService } from "@tiny-chat/client/core/services/StreamService.ts";
import { useConfig } from "@tiny-chat/client/features/agent/hooks/useConfig.ts";
import { useStreamStore } from "@tiny-chat/client/features/agent/stores/useStreamStore.ts";
import { useChat } from "@tiny-chat/client/features/chat/hooks/useChat.ts";
import { useMessaging } from "@tiny-chat/client/features/chat/hooks/useMessaging.ts";
import { useDraftStore } from "@tiny-chat/client/features/chat/stores/useDraftStore.ts";
import type {
	Categories,
	Usage,
} from "@tiny-chat/client/features/editor/hooks/useEstimatedTokens.ts";
import { useEffect } from "react";
import { AppService } from "#app/core/services/AppService.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import ConfigPanel from "#app/features/editor/components/ConfigPanel.tsx";
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
	const { config, setConfig } = useConfig();
	const currentModal = useAppStore((state) => state.currentModal);

	const stream = useStreamStore((state) =>
		state.chatAgentStreams.get(chat.data?.id ?? ""),
	);

	const [opened, { toggle, close }] = useDisclosure();

	const isEmpty = useDraftStore((state) => state.isEmpty);
	const isIncomplete = useEditorStore((state) => state.isIncomplete);

	const modelWidth = width * 0.25;

	useEffect(() => {
		const onClickOutside = (event: PointerEvent) => {
			if (!opened || currentModal) return;
			if (event.target instanceof HTMLElement) {
				const isRightSection = event.target.closest(".right-section");
				if (!isRightSection) {
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
					<ConfigPanel
						config={config}
						setConfig={setConfig}
						onMore={(capabilities) => AppService.openCapabilities(capabilities)}
						disabled={disabled}
						className="right-section"
					/>
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
