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
import { LogLevel } from "#core/logger.ts";
import { useLogStore } from "#ui/core/stores/useLogStore.tsx";
import { GLASS_STYLE } from "#ui/utils/style.ts";

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
										log.level === LogLevel.error
											? "red"
											: log.level === LogLevel.warn
												? "yellow"
												: "gray"
									}
								>
									{log.data.map((d, i) =>
										typeof d === "object" ? (
											// biome-ignore lint/suspicious/noArrayIndexKey: logs do not change
											<JsonTree data={d} key={i} />
										) : (
											// biome-ignore lint/suspicious/noArrayIndexKey: logs do not change
											<Text size="xs" key={i}>
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
