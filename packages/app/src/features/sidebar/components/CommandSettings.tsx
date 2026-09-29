import { ActionIcon, Box, Text, TextInput, Tooltip } from "@mantine/core";
import { TrashIcon } from "@phosphor-icons/react";
import { useShellSettings } from "@tiny-chat/client/features/settings/hooks/useShellSettings.ts";
import type { ProjectLike } from "@tiny-chat/core/features/data/types/chat.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";

export default function CommandSettings({
	project,
}: {
	project: ProjectLike | null;
}) {
	const { commandWhitelist, addCommand, editCommand, removeCommand } =
		useShellSettings({ project });

	return (
		<>
			<Box>
				<Text size="sm">Commands</Text>
				<Text size="xs" c="dimmed">
					Runs matching shell commands without approval
				</Text>
			</Box>
			{commandWhitelist.map((command, index) => (
				<TextInput
					key={command}
					defaultValue={command}
					ff="monospace"
					onKeyDown={(e) =>
						e.key === "Enter" && (e.target as HTMLInputElement).blur()
					}
					onBlur={(e) => {
						const value = e.target.value.trim();
						if (value === command) return;
						if (value) editCommand.mutate({ project, index, command: value });
						else removeCommand.mutate({ project, index });
					}}
					rightSection={
						<ActionIcon
							variant="subtle"
							onClick={() => removeCommand.mutate({ project, index })}
							disabled={
								removeCommand.isPending &&
								removeCommand.variables.index === index
							}
						>
							<TrashIcon size={20} />
						</ActionIcon>
					}
					disabled={
						(editCommand.isPending && editCommand.variables.index === index) ||
						(removeCommand.isPending && removeCommand.variables.index === index)
					}
				/>
			))}
			<Tooltip label="Use * to match anything" position="right">
				<TextInput
					key="add"
					label="Command"
					styles={StyleUtils.input}
					ff="monospace"
					placeholder="npm run *"
					onKeyDown={(e) =>
						e.key === "Enter" && (e.target as HTMLInputElement).blur()
					}
					onBlur={(e) => {
						const value = e.target.value.trim();
						if (!value) return;
						addCommand.mutate({ project, command: value });
						e.target.value = "";
					}}
					disabled={addCommand.isPending}
				/>
			</Tooltip>
		</>
	);
}
