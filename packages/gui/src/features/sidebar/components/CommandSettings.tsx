import {
	ActionIcon,
	Box,
	Checkbox,
	Paper,
	Stack,
	Text,
	TextInput,
	Tooltip,
} from "@mantine/core";
import { TrashIcon } from "@phosphor-icons/react";
import { useShellSettings } from "#client/features/settings/hooks/useShellSettings.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";
import { StyleUtils } from "#gui/core/utils/StyleUtils.ts";

export default function CommandSettings({
	project,
}: {
	project: ProjectLike | null;
}) {
	const { commands, addCommand, updateCommand, removeCommand } =
		useShellSettings({ project });

	return (
		<>
			<Box>
				<Text size="sm">Commands</Text>
				<Text size="xs" c="dimmed">
					Runs matching shell commands without approval
				</Text>
			</Box>
			{commands.map((command, index) => {
				const pending =
					(updateCommand.isPending &&
						updateCommand.variables.index === index) ||
					(removeCommand.isPending && removeCommand.variables.index === index);
				return (
					<Paper key={command.command} withBorder p="xs">
						<Stack gap={6} flex={1} miw={0}>
							<TextInput
								defaultValue={command.command}
								ff="monospace"
								onKeyDown={(e) =>
									e.key === "Enter" && (e.target as HTMLInputElement).blur()
								}
								onBlur={(e) => {
									const value = e.target.value.trim();
									if (value === command.command) return;
									if (value)
										updateCommand.mutate({
											project,
											index,
											command: { command: value },
										});
									else removeCommand.mutate({ project, index });
								}}
								rightSection={
									<ActionIcon
										variant="subtle"
										onClick={() => removeCommand.mutate({ project, index })}
										disabled={pending}
									>
										<TrashIcon size={20} />
									</ActionIcon>
								}
								disabled={pending}
							/>
							<Checkbox
								size="xs"
								label="Skip approval for matching"
								checked={command.whitelist}
								disabled={pending}
								onChange={(event) =>
									updateCommand.mutate({
										project,
										index,
										command: { whitelist: event.currentTarget.checked },
									})
								}
							/>
						</Stack>
					</Paper>
				);
			})}
			<Tooltip label="How to handle model commands" position="right">
				<TextInput
					key="add"
					label="Command"
					styles={StyleUtils.input}
					ff="monospace"
					placeholder="command (use * to match anything)"
					onKeyDown={(e) =>
						e.key === "Enter" && (e.target as HTMLInputElement).blur()
					}
					onBlur={(e) => {
						const value = e.target.value.trim();
						if (!value) return;
						addCommand.mutate({
							project,
							command: { command: value, whitelist: false },
						});
						e.target.value = "";
					}}
					disabled={addCommand.isPending}
				/>
			</Tooltip>
		</>
	);
}
