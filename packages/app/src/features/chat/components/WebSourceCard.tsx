import { Stack, Text, UnstyledButton } from "@mantine/core";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import type { zWebContext } from "@tiny-chat/core/src/features/provider/types/web.ts";
import { useMemo } from "react";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { useChatFilesStore } from "#app/features/chat/stores/useChatFilesStore.ts";

export default function WebSourceCard({
	source,
	selected = false,
	unstyled,
}: {
	source: zWebContext;
	selected?: boolean;
	unstyled?: boolean;
}) {
	const chatId = useChatStore((state) => state.chatId);
	const viewFile = useChatFilesStore((state) => state.viewFile);
	const setAsideOpen = useAppStore((state) => state.setAsideOpen);

	const props = useMemo<UnstyledButton.Props>(() => {
		if (unstyled) return {};
		return {
			p: "xs",
			style: {
				border: "1px solid var(--mantine-color-default-border)",
				borderRadius: "var(--mantine-radius-md)",
				background: selected
					? "var(--mantine-color-blue-light)"
					: "var(--mantine-color-default)",
			},
		};
	}, [selected, unstyled]);

	return (
		<UnstyledButton
			w="100%"
			aria-pressed={selected}
			onClick={() => {
				viewFile({
					path: `web:${source.url}`,
					directory: false,
					chatId,
					web: source,
				});
				setAsideOpen(true);
			}}
			{...props}
		>
			<Stack gap={4}>
				<Text fw={500} truncate="end">
					{source.title || source.url}
				</Text>
				<Text size="xs" c="dimmed" truncate>
					{source.url}
				</Text>
			</Stack>
		</UnstyledButton>
	);
}
