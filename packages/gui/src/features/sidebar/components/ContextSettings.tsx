import {
	ActionIcon,
	Box,
	Slider,
	Space,
	Text,
	Textarea,
	Tooltip,
} from "@mantine/core";
import { TrashIcon } from "@phosphor-icons/react";
import { useInstructions } from "#client/features/settings/hooks/useInstructions.ts";
import type { ProjectLike } from "#core/features/data/types/chat.ts";
import { StyleUtils } from "#gui/core/utils/StyleUtils.ts";

export default function ContextSettings({
	project,
}: {
	project: ProjectLike | null;
}) {
	const {
		instructions,
		addInstruction,
		updateInstruction,
		removeInstruction,
		memoryBudget,
		setMemoryBudget,
	} = useInstructions({ project });

	return (
		<>
			<Box>
				<Text size="sm">Context</Text>
				<Text size="xs" c="dimmed">
					Shapes model responses
				</Text>
			</Box>
			{instructions?.map((instruction, index) => (
				<Textarea
					key={instruction}
					defaultValue={instruction}
					autosize
					onKeyDown={(e) =>
						e.key === "Enter" && (e.target as HTMLInputElement).blur()
					}
					onBlur={(e) => {
						if (e.target.value === instruction) return;
						if (e.target.value)
							updateInstruction.mutate({
								project,
								index,
								instruction: e.target.value,
							});
						else removeInstruction.mutate({ project, index });
					}}
					leftSection={
						<Text c="dimmed" size="xs">
							{index + 1}
						</Text>
					}
					rightSection={
						<ActionIcon
							variant="subtle"
							onClick={() => removeInstruction.mutate({ project, index })}
							disabled={
								removeInstruction.isPending &&
								removeInstruction.variables.index === index
							}
						>
							<TrashIcon size={20} />
						</ActionIcon>
					}
					disabled={
						(updateInstruction.isPending &&
							updateInstruction.variables.index === index) ||
						(removeInstruction.isPending &&
							removeInstruction.variables.index === index)
					}
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
					onKeyDown={(e) =>
						e.key === "Enter" && (e.target as HTMLInputElement).blur()
					}
					onBlur={(e) => {
						if (!e.target.value) return;
						addInstruction.mutate({ project, instruction: e.target.value });
						e.target.value = "";
					}}
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
