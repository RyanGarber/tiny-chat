import { JsonTree } from "@gfazioli/mantine-json-tree";
import {
	ActionIcon,
	Box,
	Group,
	Modal,
	ScrollArea,
	Stack,
	Tabs,
	Text,
} from "@mantine/core";
import { EraserIcon } from "@phosphor-icons/react";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
	type ConsoleLog,
	useConsoleStore,
} from "#client/core/stores/useConsoleStore.ts";
import { LogLevel } from "#core/logger.ts";
import { useAppStore } from "#gui/core/stores/useAppStore.ts";

/** Log lines, newest last; shared with each MCP server's own log. */
export function LogList({ logs }: { logs: ConsoleLog[] }) {
	return (
		<Stack gap={5}>
			{logs.map((log) => (
				<Group
					key={log.id}
					gap={5}
					align="flex-start"
					justify="space-between"
					wrap="nowrap"
					bg="var(--mantine-color-default)"
					bdrs="md"
					p="5px 10px 4px"
				>
					<Box m="-6px 2.5px 0 -5px">
						<Text c="dimmed">&middot;</Text>
					</Box>
					<Group
						align="flex-start"
						flex={1}
						miw={0}
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
								<Text size="xs" key={i} style={{ wordBreak: "break-word" }}>
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
	);
}

/** Mounted only while the console is open, so a log renders nothing otherwise. */
function ConsoleLogs() {
	const logs = useConsoleStore((state) => state.logs);

	return (
		<ScrollArea offsetScrollbars>
			<LogList logs={logs} />
		</ScrollArea>
	);
}

export default function Console() {
	const currentModal = useAppStore((state) => state.currentModal);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const clearLogs = useConsoleStore((state) => state.clearLogs);

	return (
		<Modal
			opened={currentModal === "console"}
			onClose={() => setCurrentModal(null)}
			title={
				<Group gap={5}>
					Console{" "}
					<ActionIcon variant="transparent" c="dimmed" onClick={clearLogs}>
						<EraserIcon size={20} />
					</ActionIcon>
				</Group>
			}
			zIndex="calc(var(--mantine-z-index-modal) + 1)"
			size="lg"
			fullScreen
			className="selectable"
		>
			<Tabs variant="pills" defaultValue="logs">
				<Tabs.List mb="md">
					<Tabs.Tab value="logs">Logs</Tabs.Tab>
					{import.meta.env.DEV && <Tabs.Tab value="queries">Queries</Tabs.Tab>}
				</Tabs.List>
				<Tabs.Panel value="logs">
					<ConsoleLogs />
				</Tabs.Panel>
				{import.meta.env.DEV && (
					<Tabs.Panel value="queries">
						<ReactQueryDevtoolsPanel />
					</Tabs.Panel>
				)}
			</Tabs>
		</Modal>
	);
}
