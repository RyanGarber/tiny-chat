import { JsonTree } from "@gfazioli/mantine-json-tree";
import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Group,
	Modal,
	type ModalProps,
	ScrollArea,
	Stack,
	Text,
} from "@mantine/core";
import { useLogStore } from "#frontend/core/stores/useLogStore.tsx";
import { GLASS_STYLE } from "#frontend/utils/theme.ts";
import { Level } from "#shared/logs.ts";

export default function Console({
	opened,
	onClose,
}: Pick<ModalProps, "opened" | "onClose">) {
	const logs = useLogStore((s) => s.logs);
	const clearLogs = useLogStore((s) => s.clearLogs);

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			title={
				<Group gap={5}>
					Console{" "}
					<ActionIcon variant="transparent" c="dimmed" onClick={clearLogs}>
						<Icon icon="lucide:eraser" />
					</ActionIcon>
				</Group>
			}
			zIndex="calc(var(--mantine-z-index-modal) + 1)"
			size="lg"
			styles={{ content: GLASS_STYLE }}
			fullScreen
			className="selectable"
		>
			<Stack>
				<ScrollArea offsetScrollbars>
					<Stack gap={5}>
						{logs.map((log) => (
							<Group
								key={log.id}
								gap={5}
								align="flex-start"
								justify="space-between"
								bg="var(--mantine-color-default)"
								bdrs="md"
								p="5px 10px 4px"
							>
								<Icon
									icon="lucide:dot"
									color="gray"
									style={{ margin: "0 -2.5px 0 -5px" }}
								/>
								<Group
									align="flex-start"
									flex={1}
									c={
										log.level === Level.error
											? "red"
											: log.level === Level.warn
												? "yellow"
												: "gray"
									}
								>
									{log.data.map((d) =>
										typeof d === "object" ? (
											<JsonTree data={d} key={String(d)} />
										) : (
											<Text size="xs" key={String(d)}>
												{String(d)}
											</Text>
										),
									)}
								</Group>
								<Text size="xs" c="dimmed">
									{log.time}
								</Text>
							</Group>
						))}
					</Stack>
				</ScrollArea>
			</Stack>
		</Modal>
	);
}
