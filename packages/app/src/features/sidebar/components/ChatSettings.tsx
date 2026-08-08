import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Box,
	Button,
	CheckboxCard,
	CheckboxIndicator,
	Group,
	Modal,
	Progress,
	Select,
	Space,
	Stack,
	Text,
	Textarea,
	Tooltip,
} from "@mantine/core";
import { useMutationState } from "@tanstack/react-query";
import { useProviders } from "@tiny-chat/client/src/features/agent/hooks/useProviders.ts";
import { useEmbeddingSettings } from "@tiny-chat/client/src/features/settings/hooks/useEmbeddingSettings.ts";
import { useInstructions } from "@tiny-chat/client/src/features/settings/hooks/useInstructions.ts";
import { useProviderSettings } from "@tiny-chat/client/src/features/settings/hooks/useProviderSettings.ts";
import {
	runEmbeddingBatchMutationKey,
	useEmbedding,
} from "@tiny-chat/client/src/features/user/hooks/useEmbedding.ts";
import type { zConfig } from "@tiny-chat/core/src/features/data/types/message.ts";
import { useMemo, useState } from "react";
import ModelSelect from "#app/core/components/ModelSelect.tsx";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";

export default function ChatSettings() {
	const { providers } = useProviders();

	const { instructions, addInstruction, editInstruction, removeInstruction } =
		useInstructions();
	const { preferredWebProvider, setPreferredWebProvider } =
		useProviderSettings();
	const {
		embeddingConfig,
		setEmbeddingConfig,
		useEmbeddingSearch,
		setUseEmbeddingSearch,
	} = useEmbeddingSettings();

	const currentModal = useAppStore((state) => state.currentModal);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const [newEmbeddingConfig, setNewEmbeddingConfig] = useState<zConfig | null>(
		null,
	);

	const { nextEmbeddingBatch } = useEmbedding();

	const runEmbeddingBatchState =
		useMutationState({
			filters: { mutationKey: runEmbeddingBatchMutationKey },
			select: (m) => m.state.status,
		}).at(-1) ?? "idle";

	const { batchCount, totalCount } = useMemo(() => {
		return {
			batchCount:
				(nextEmbeddingBatch.data?.messages.length ?? 0) +
				(nextEmbeddingBatch.data?.memories.length ?? 0) +
				(nextEmbeddingBatch.data?.files.length ?? 0),
			totalCount:
				Number(nextEmbeddingBatch.data?.messages[0]?.total ?? 0) +
				Number(nextEmbeddingBatch.data?.memories[0]?.total ?? 0) +
				Number(nextEmbeddingBatch.data?.files[0]?.total ?? 0),
		};
	}, [nextEmbeddingBatch.data]);

	return (
		<Stack>
			<Box>
				<Text size="sm">Instructions</Text>
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
							editInstruction.mutate({
								index,
								instruction: e.target.value,
							});
						else removeInstruction.mutate({ index });
					}}
					leftSection={
						<Text c="dimmed" size="xs">
							{index + 1}
						</Text>
					}
					rightSection={
						<ActionIcon
							variant="subtle"
							onClick={() => removeInstruction.mutate({ index })}
							disabled={
								removeInstruction.isPending &&
								removeInstruction.variables.index === index
							}
						>
							<Icon icon="lucide:trash" height={18} />
						</ActionIcon>
					}
					disabled={
						(editInstruction.isPending &&
							editInstruction.variables.index === index) ||
						(removeInstruction.isPending &&
							removeInstruction.variables.index === index)
					}
				/>
			))}
			<Tooltip
				label="System instructions for models"
				color="gray"
				position="right"
			>
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
						addInstruction.mutate({ instruction: e.target.value });
						e.target.value = "";
					}}
					disabled={addInstruction.isPending}
				/>
			</Tooltip>
			<Space />
			<Box>
				<Text size="sm">Retrieval</Text>
				<Text size="xs" c="dimmed">
					Enables memory and smart search
					{totalCount > 0 && ` (${totalCount.toLocaleString()})`}
				</Text>
				{totalCount > 0 && (
					<Progress
						my={5}
						value={
							runEmbeddingBatchState === "error"
								? 100
								: runEmbeddingBatchState === "idle"
									? 0
									: Math.min(100, (batchCount / totalCount) * 100)
						}
						color={
							runEmbeddingBatchState === "error"
								? "red"
								: runEmbeddingBatchState === "idle"
									? "gray"
									: undefined
						}
						animated={runEmbeddingBatchState === "pending"}
					/>
				)}
			</Box>
			<Tooltip
				label="Model that generates embeddings"
				color="gray"
				position="right"
			>
				<ModelSelect
					label="Embedding Model"
					styles={StyleUtils.input}
					optional
					configValue={embeddingConfig}
					onConfigChange={(value) => {
						setNewEmbeddingConfig(value ?? null);
						setCurrentModal("embedding-config");
					}}
					feature="embedding"
					disabled={
						currentModal === "embedding-config" || setEmbeddingConfig.isPending
					}
					readOnly={
						currentModal === "embedding-config" || setEmbeddingConfig.isPending
					}
				/>
			</Tooltip>
			<Modal
				title="Change Embedding Model"
				opened={currentModal === "embedding-config"}
				onClose={() => setCurrentModal(null)}
				styles={{ content: StyleUtils.input }}
				centered
			>
				{newEmbeddingConfig ? (
					<Text>
						All embeddings will be regenerated using the model{" "}
						<strong>{newEmbeddingConfig.model}</strong>.
					</Text>
				) : (
					<Text>
						Features like memory and smart search will not be available.
					</Text>
				)}
				<Button
					variant="gradient"
					fullWidth
					onClick={() => {
						setEmbeddingConfig.mutate({ config: newEmbeddingConfig });
						setCurrentModal(null);
					}}
					mt="lg"
					disabled={setEmbeddingConfig.isPending}
					loading={setEmbeddingConfig.isPending}
				>
					Confirm
				</Button>
			</Modal>
			<Tooltip
				label={
					embeddingConfig
						? "Considers semantic meaning of text"
						: "Requires embedding model"
				}
				color="gray"
				position="right"
			>
				<CheckboxCard
					p="xs"
					checked={useEmbeddingSearch}
					onChange={(value) => {
						setUseEmbeddingSearch.mutate({
							useEmbeddingSearch: value,
						});
					}}
					disabled={!embeddingConfig || setUseEmbeddingSearch.isPending}
					style={{
						cursor: !embeddingConfig ? "not-allowed" : "pointer",
					}}
				>
					<Group>
						<CheckboxIndicator size="xs" />
						<Text size="sm">Smart Search</Text>
					</Group>
				</CheckboxCard>
			</Tooltip>
			<Space />
			<Box>
				<Text size="sm">Web</Text>
				<Text size="xs" c="dimmed">
					Enables web browsing for chat models
				</Text>
			</Box>
			<Tooltip
				label="Provider used for web browsing"
				color="gray"
				position="right"
			>
				<Select
					label="Preferred Provider"
					styles={StyleUtils.input}
					allowDeselect={false}
					data={
						providers.data
							?.filter(
								(provider) => provider.type === "web" && provider.status.valid,
							)
							.map((p) => p.name) ?? []
					}
					value={preferredWebProvider}
					onChange={(value) => {
						if (!value) return;
						setPreferredWebProvider.mutate({
							preferredWebProvider: value,
						});
					}}
					disabled={setPreferredWebProvider.isPending}
					readOnly={setPreferredWebProvider.isPending}
				/>
			</Tooltip>
		</Stack>
	);
}
