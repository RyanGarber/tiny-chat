import {
	ActionIcon,
	Box,
	Checkbox,
	Group,
	Paper,
	Stack,
	Text,
	TextInput,
	Tooltip,
} from "@mantine/core";
import { TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useShellSettings } from "#client/features/settings/hooks/useShellSettings.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";
import SaveButton from "#gui/core/components/SaveButton.tsx";
import { ControlUtils } from "#gui/core/utils/ControlUtils.ts";
import { StyleUtils } from "#gui/core/utils/StyleUtils.ts";

function Command({
	project,
	command,
	index,
}: {
	project: ProjectLike | null;
	command: { command: string; whitelist: boolean };
	index: number;
}) {
	// Its own mutations, so only this command waits on them.
	const { updateCommand, removeCommand } = useShellSettings({ project });
	const [draft, setDraft] = useState(command.command);
	const dirty = draft.trim() !== command.command;
	const pending = updateCommand.isPending || removeCommand.isPending;

	const save = () => {
		const value = draft.trim();
		if (value === command.command) return;
		if (value)
			updateCommand.mutate({ project, index, command: { command: value } });
		else removeCommand.mutate({ project, index });
	};

	return (
		<Paper withBorder p="xs">
			<Stack gap={6} flex={1} miw={0}>
				<TextInput
					value={draft}
					ff="monospace"
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={ControlUtils.onEnter(save)}
					rightSectionWidth={dirty || updateCommand.isPending ? 64 : undefined}
					rightSection={
						<Group gap={0} wrap="nowrap">
							<SaveButton
								dirty={dirty}
								loading={updateCommand.isPending}
								disabled={pending}
								onClick={save}
							/>
							<ActionIcon
								variant="subtle"
								aria-label="Remove command"
								onClick={() => removeCommand.mutate({ project, index })}
								disabled={pending}
							>
								<TrashIcon size={20} />
							</ActionIcon>
						</Group>
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
}

export default function CommandSettings({
	project,
}: {
	project: ProjectLike | null;
}) {
	const { commands, addCommand } = useShellSettings({ project });

	const [draft, setDraft] = useState("");
	const add = () => {
		const value = draft.trim();
		if (!value) return;
		addCommand.mutate(
			{ project, command: { command: value, whitelist: false } },
			{ onSuccess: () => setDraft("") },
		);
	};

	return (
		<>
			<Box>
				<Text size="sm">Commands</Text>
				<Text size="xs" c="dimmed">
					Runs matching shell commands without approval
				</Text>
			</Box>
			{commands.map((command, index) => (
				<Command
					key={command.command}
					project={project}
					command={command}
					index={index}
				/>
			))}
			<Tooltip label="How to handle model commands" position="right">
				<TextInput
					key="add"
					label="Command"
					styles={StyleUtils.input}
					ff="monospace"
					placeholder="command (use * to match anything)"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={ControlUtils.onEnter(add)}
					rightSection={
						<SaveButton
							label="Add command"
							dirty={!!draft.trim()}
							loading={addCommand.isPending}
							onClick={add}
						/>
					}
					disabled={addCommand.isPending}
				/>
			</Tooltip>
		</>
	);
}
