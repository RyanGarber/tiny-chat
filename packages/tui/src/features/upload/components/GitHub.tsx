import { useQuery } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
import { ClientContext } from "#client/client.ts";
import { MessagingService } from "#client/features/chat/services/MessagingService.ts";
import type {
	CompletionGroup,
	CompletionItem,
} from "#client/features/editor/types/completion.ts";
import { useUploads } from "#client/features/upload/hooks/useUploads.ts";
import { CommonUtils } from "#core/core/utils/CommonUtils.ts";
import Text from "#tui/core/components/Text.tsx";
import { usePage } from "#tui/core/hooks/usePage.ts";
import { useWorkingStatus } from "#tui/core/hooks/useWorkingStatus.ts";
import Completions from "#tui/features/editor/components/Completions.tsx";

interface GitHubItem extends CompletionItem {
	detail?: string;
	error?: unknown;
	/** Clones the repository, or attaches the clone once there is one. */
	attach: () => Promise<void> | void;
	clone: () => Promise<void> | void;
	remove: () => void;
}

/**
 * The GitHub repositories the account can reach, and the clones of them the
 * next message can be sent with.
 *
 * A clone is attached by referencing its directory on the chat mount, so
 * picking one writes that reference into the editor.
 *
 * GitHub hands over every repository at once, so the list is grown a page at a
 * time as it is read rather than fetched a page at a time.
 */
export default function GitHub() {
	const client = useContext(ClientContext);

	const { githubUploads, deleteUpload, cloneGitHubRepository } = useUploads();

	const repos = useQuery({
		...client.query.upload.getGitHubRepositories.queryOptions(),
		select: (data) =>
			[...data].sort(
				(a, b) =>
					new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
			),
	});

	const { setPage } = usePage();

	useWorkingStatus(repos, githubUploads, cloneGitHubRepository, deleteUpload);

	const groups = useMemo((): CompletionGroup<GitHubItem>[] => {
		return [
			{
				items: (repos.data ?? []).map((repo) => {
					const [owner, repository] = repo.full_name.split("/");

					const existing = githubUploads.data?.find(
						(upload) =>
							upload.repoName === repo.full_name &&
							upload.branch === repo.default_branch,
					);

					// The mutation only ever holds the last repository it was asked
					// for, so its state belongs to that one alone.
					const mutating =
						cloneGitHubRepository.variables?.owner === owner &&
						cloneGitHubRepository.variables?.repository === repository;

					const cloning = mutating && cloneGitHubRepository.isPending;

					const detail = cloning
						? "cloning..."
						: existing
							? `cloned ${CommonUtils.formatDate({ date: existing.createdAt, relative: true })}`
							: "not cloned";

					return {
						name: repo.full_name,
						value: String(repo.id),
						detail,
						error: mutating ? cloneGitHubRepository.error : undefined,
						attach: () => {
							if (!existing) return;
							MessagingService.attachUpload({ client, upload: existing });
							setPage("chat");
						},
						clone: () => {
							cloneGitHubRepository.mutate({
								owner,
								repository,
								branch: repo.default_branch,
							});
						},
						remove: () => {
							if (!existing) return;
							deleteUpload.mutate({ id: existing.id });
						},
					};
				}),
			},
		];
	}, [
		repos.data,
		githubUploads.data,
		cloneGitHubRepository,
		deleteUpload,
		setPage,
		client,
	]);

	return (
		<Completions<CompletionGroup<GitHubItem>, GitHubItem>
			groups={groups}
			renderItem={({ item }) => {
				return (
					<Text color={item.error ? "redBright" : undefined}>
						{item.name}
						<Text color={item.error ? "redBright" : "textSubtle"}>
							{item.error
								? ` · ${CommonUtils.formatError({ error: item.error })}`
								: ` · ${item.detail}`}
						</Text>
					</Text>
				);
			}}
			renderEmpty={() =>
				repos.error
					? CommonUtils.formatError({ error: repos.error })
					: "nothing here yet"
			}
			onInput={({ item, key, input }) => {
				if ((key.return || input === " ") && item) item.attach();
				if (input === "c" && item) item.clone();
				if (input === "d" && item) item.remove();
			}}
			actions={[
				{ key: "c", name: "clone" },
				{ key: "d", name: "delete" },
				"select",
				"back",
			]}
			selectFirstOnChange={false}
		/>
	);
}
