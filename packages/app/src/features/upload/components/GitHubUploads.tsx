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
import { useQuery } from "@tanstack/react-query";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { useState } from "react";
import { client } from "#app/client.ts";
import Sentinel from "#app/core/components/Sentinel.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import { MessagingService } from "#client/src/features/chat/services/MessagingService.ts";
import { useUploads } from "#client/src/features/upload/hooks/useUploads.ts";

export function GitHubUploads({ close }: { close: () => void }) {
	// Logic from GitHub.tsx
	const [search, setSearch] = useState("");

	const repos = useQuery({
		...client.query.upload.getGitHubRepositories.queryOptions(),
		select: (data) =>
			[
				...data.filter((p) =>
					p.full_name.toLowerCase().includes(search.toLowerCase().trim()),
				),
			].sort(
				(a, b) =>
					new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
			),
	});

	const { githubUploads, deleteUpload, cloneGitHubRepository } = useUploads();

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
							const [owner, repoName] = repo.full_name.split("/");
							const existing = githubUploads.data?.find(
								(u) =>
									u.repoName === repo.full_name &&
									u.branch === repo.default_branch,
							);

							const isMutating =
								cloneGitHubRepository.variables?.owner === owner &&
								cloneGitHubRepository.variables?.repository === repoName &&
								cloneGitHubRepository.variables?.branch === repo.default_branch;
							const isCloning = isMutating
								? cloneGitHubRepository.isPending
								: false;
							const cloneError = isMutating
								? cloneGitHubRepository.error
								: undefined;

							return (
								<Box
									key={repo.id}
									p="xs"
									bdrs="lg"
									style={{
										...StyleUtils.glass,
										cursor: existing ? "pointer" : "default",
									}}
									onClick={() => {
										if (!existing) return;
										MessagingService.attachUpload({
											client,
											upload: existing,
										});
										close();
									}}
								>
									<Group justify="space-between" wrap="nowrap" gap="xs">
										<Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
											<Group gap={6} wrap="nowrap">
												<Text size="sm" fw={500} truncate>
													{repo.full_name}
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
													Last commit{" "}
													{CommonUtils.formatDate({
														date: new Date(repo.updated_at),
														relative: true,
													})}
												</Text>
											</Group>
										</Stack>
										<Stack gap={4} align="end">
											<Group gap={0} wrap="nowrap">
												{existing && (
													<ActionIcon
														variant="subtle"
														color="red"
														onClick={(e) => {
															e.stopPropagation();
															deleteUpload.mutate({ id: existing.id });
														}}
														loading={
															deleteUpload.isPending &&
															deleteUpload.variables.id === existing.id
														}
														disabled={
															deleteUpload.isPending &&
															deleteUpload.variables.id === existing.id
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
														cloneGitHubRepository.mutate({
															owner,
															repository: repoName,
															branch: repo.default_branch,
														});
													}}
													loading={isCloning}
													disabled={isCloning}
												>
													{existing ? (
														<Icon icon="lucide:refresh-cw" height={16} />
													) : (
														<Icon icon="lucide:download-cloud" height={16} />
													)}
												</ActionIcon>
											</Group>
											{existing && (
												<Text size="xs" c="dimmed" truncate>
													{CommonUtils.formatDate({
														date: existing.createdAt,
														relative: true,
													})}
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
