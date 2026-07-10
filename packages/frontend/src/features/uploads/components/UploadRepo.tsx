import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Badge,
	Box,
	Center,
	Group,
	ScrollArea,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "timeago.js";
import Sentinel from "#frontend/core/components/Sentinel.tsx";
import { useInputStore } from "#frontend/features/chat/stores/useInputStore.ts";
import { fetchNextEmbeddingBatch } from "#frontend/features/config/hooks/useEmbedding.ts";
import { query } from "#frontend/utils/api.ts";
import { GLASS_STYLE } from "#frontend/utils/theme.ts";
import { useUploads } from "../hooks/useUploads";

export function UploadRepo({ onClose }: { onClose: () => void }) {
	// Logic from GitHub.tsx
	const [search, setSearch] = useState("");
	const addAttachment = useInputStore((s) => s.addAttachment);

	const repos = useQuery({
		...query.input.listRepos.queryOptions(),
		select: (data) =>
			[
				...data.filter((p) =>
					p.fullName.toLowerCase().includes(search.toLowerCase().trim()),
				),
			].sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			),
	});

	const cloneRepo = useMutation({
		...query.input.cloneRepo.mutationOptions(),
		onSuccess: (data) => {
			addAttachment(data);
			void githubUploads.refetch();
			void fetchNextEmbeddingBatch();
		},
	});

	const { githubUploads, deleteUpload } = useUploads();

	return (
		<Stack h="100%" gap="md">
			<TextInput
				placeholder="Search repositories…"
				leftSection={<Icon icon="lucide:search" height={16} />}
				value={search}
				onChange={(e) => setSearch(e.currentTarget.value)}
			/>

			{repos.isError ? (
				<Text size="sm" c="red" ta="center">
					{repos.error?.message}
				</Text>
			) : (
				<ScrollArea h={400}>
					<Stack gap="xs">
						{repos.data?.length === 0 && (
							<Center py={20}>
								<Text size="sm" c="dimmed">
									No repositories found
								</Text>
							</Center>
						)}
						{repos.data?.map((repo) => {
							const [owner, repoName] = repo.fullName.split("/");
							const historyItem = githubUploads.data?.find(
								(u) =>
									u.repoName === repo.fullName &&
									u.branch === repo.defaultBranch,
							);

							const isMutating =
								cloneRepo.variables?.owner === owner &&
								cloneRepo.variables?.repo === repoName &&
								cloneRepo.variables?.branch === repo.defaultBranch;
							const isCloning = isMutating ? cloneRepo.isPending : false;
							const cloneError = isMutating ? cloneRepo.error : undefined;

							return (
								<Box
									key={repo.id}
									p="xs"
									bdrs="lg"
									style={{
										...GLASS_STYLE,
										cursor: historyItem ? "pointer" : "default",
									}}
									onClick={() => {
										if (!historyItem) return;
										addAttachment({
											type: "upload",
											id: historyItem.id,
											name: historyItem.name,
										});
										onClose();
									}}
								>
									<Group justify="space-between" wrap="nowrap" gap="xs">
										<Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
											<Group gap={6} wrap="nowrap">
												<Text size="sm" fw={500} truncate>
													{repo.fullName}
												</Text>
												{repo.private && (
													<Badge size="xs" variant="light" color="gray">
														private
													</Badge>
												)}
											</Group>
											{repo.description && (
												<Text size="xs" c="dimmed" truncate>
													{repo.description}
												</Text>
											)}
											{cloneError && (
												<Text size="xs" c="red" truncate>
													{cloneError instanceof Error
														? cloneError.message
														: "Unknown error"}
												</Text>
											)}
											<Group gap={6} wrap="nowrap">
												<Text size="xs" c="dimmed" flex="0 0 auto">
													Last commit {format(repo.updatedAt)}
												</Text>
											</Group>
										</Stack>
										<Stack gap={4} align="end">
											<Group gap={0} wrap="nowrap">
												{historyItem && (
													<ActionIcon
														variant="subtle"
														color="red"
														onClick={(e) => {
															e.stopPropagation();
															deleteUpload.mutate({ id: historyItem.id });
														}}
														loading={
															deleteUpload.isPending &&
															deleteUpload.variables.id === historyItem.id
														}
														disabled={
															deleteUpload.isPending &&
															deleteUpload.variables.id === historyItem.id
														}
													>
														<Icon icon="lucide:trash" height={16} />
													</ActionIcon>
												)}
												<ActionIcon
													variant="subtle"
													color="dimmed"
													onClick={(e) => {
														e.stopPropagation();
														cloneRepo.mutate({
															owner,
															repo: repoName,
															branch: repo.defaultBranch,
														});
													}}
													loading={isCloning}
													disabled={isCloning}
												>
													{historyItem ? (
														<Icon icon="lucide:refresh-cw" height={16} />
													) : (
														<Icon icon="lucide:download-cloud" height={16} />
													)}
												</ActionIcon>
											</Group>
											{historyItem && (
												<Text size="xs" c="dimmed" truncate>
													{format(historyItem.createdAt)}
												</Text>
											)}
										</Stack>
									</Group>
								</Box>
							);
						})}
						<Sentinel isFetching={repos.isFetching} />
					</Stack>
				</ScrollArea>
			)}
		</Stack>
	);
}
