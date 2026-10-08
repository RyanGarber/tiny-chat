import {
	ActionIcon,
	Box,
	Group,
	Slider,
	Space,
	Text,
	Textarea,
	Tooltip,
} from "@mantine/core";
import { TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useInstructions } from "#client/features/settings/hooks/useInstructions.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";
import SaveButton from "#gui/core/components/SaveButton.tsx";
import { ControlUtils } from "#gui/core/utils/ControlUtils.ts";
import { StyleUtils } from "#gui/core/utils/StyleUtils.ts";

function Instruction({
	project,
	instruction,
	index,
}: {
	project: ProjectLike | null;
	instruction: string;
	index: number;
}) {
	// Its own mutations, so only this instruction waits on them.
	const { updateInstruction, removeInstruction } = useInstructions({
		project,
	});
	const [draft, setDraft] = useState(instruction);
	const dirty = draft.trim() !== instruction;
	const busy = updateInstruction.isPending || removeInstruction.isPending;

	const save = () => {
		const next = draft.trim();
		if (next === instruction) return;
		if (next) updateInstruction.mutate({ project, index, instruction: next });
		else removeInstruction.mutate({ project, index });
	};

	return (
		<Textarea
			value={draft}
			autosize
			onChange={(e) => setDraft(e.target.value)}
			onKeyDown={ControlUtils.onEnter(save)}
			leftSection={
				<Text c="dimmed" size="xs">
					{index + 1}
				</Text>
			}
			rightSectionWidth={dirty || updateInstruction.isPending ? 64 : undefined}
			rightSection={
				<Group gap={0} wrap="nowrap">
					<SaveButton
						dirty={dirty}
						loading={updateInstruction.isPending}
						disabled={busy}
						onClick={save}
					/>
					<ActionIcon
						variant="subtle"
						aria-label="Remove instruction"
						onClick={() => removeInstruction.mutate({ project, index })}
						disabled={busy}
					>
						<TrashIcon size={20} />
					</ActionIcon>
				</Group>
			}
			disabled={busy}
		/>
	);
}

export default function ContextSettings({
	project,
}: {
	project: ProjectLike | null;
}) {
	const { instructions, addInstruction, memoryBudget, setMemoryBudget } =
		useInstructions({ project });

	const [draft, setDraft] = useState("");
	const add = () => {
		const instruction = draft.trim();
		if (!instruction) return;
		addInstruction.mutate(
			{ project, instruction },
			{ onSuccess: () => setDraft("") },
		);
	};

	return (
		<>
			<Box>
				<Text size="sm">Context</Text>
				<Text size="xs" c="dimmed">
					Shapes model responses
				</Text>
			</Box>
			{instructions?.map((instruction, index) => (
				<Instruction
					key={instruction}
					project={project}
					instruction={instruction}
					index={index}
				/>
			))}
			<Tooltip label="System instructions for models" position="right">
				<Textarea
					key="add"
					autosize
					label="Instruction"
					styles={{
						...StyleUtils.input,
						...{ input: { paddingTop: 25 } },
					}}
					placeholder="Keep responses short."
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={ControlUtils.onEnter(add)}
					rightSection={
						<SaveButton
							label="Add instruction"
							dirty={!!draft.trim()}
							loading={addInstruction.isPending}
							onClick={add}
						/>
					}
					disabled={addInstruction.isPending}
				/>
			</Tooltip>
			<Space />
			<Tooltip label="Fills memory up to this point" position="right">
				<Box mx={4}>
					<Text size="xs" mb={2} fw={500}>
						Memory Budget
					</Text>
					<Slider
						marks={[
							{ value: 0, label: "0" },
							{ value: 10000, label: "10k" },
						]}
						min={0}
						max={10000}
						step={500}
						value={memoryBudget}
						onChange={(value) =>
							setMemoryBudget.mutate({ project, tokens: value })
						}
					/>
				</Box>
			</Tooltip>
		</>
	);
}
