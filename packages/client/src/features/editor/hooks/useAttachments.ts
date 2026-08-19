import { FileOperationService } from "@tiny-chat/core/src/features/file/services/FileOperationService.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useCallback, useContext, useMemo, useRef } from "react";
import { ClientContext } from "../../../client.ts";
import { useChatFiles } from "../../chat/hooks/useChatFiles.ts";
import { useUploads } from "../../upload/hooks/useUploads.ts";
import type { AttachmentGroup } from "../types/attachment.ts";
import { AttachmentUtils } from "../utils/AttachmentUtils.ts";

/**
 * Build the attachments available to any client: everything on the mount, the
 * uploads and repositories the account holds, plus files on the local machine
 * when the client can read the filesystem.
 */
export const useAttachments = () => {
	const client = useContext(ClientContext);

	const { filesystem } = useChatFiles();
	const filesystemRef = useRef(filesystem);
	filesystemRef.current = filesystem;

	const { attachmentUploads, githubUploads } = useUploads();

	// An upload the chat does not point into yet is not on the mount, so it is
	// offered from the account's own uploads. Choosing one names its directory,
	// which is both the attachment and the way into its files.
	const uploadGroups = useMemo((): AttachmentGroup[] => {
		const toGroup = (
			name: string,
			uploads: { id: string; name: string }[] | undefined,
		) =>
			uploads?.length
				? [
						{
							name,
							items: uploads.map((upload) =>
								AttachmentUtils.forUpload({ upload }),
							),
						},
					]
				: [];

		return [
			...toGroup(
				"Uploads",
				attachmentUploads.data?.pages.flatMap((page) => page.uploads),
			),
			...toGroup("GitHub", githubUploads.data),
		];
	}, [attachmentUploads.data, githubUploads.data]);

	const uploadGroupsRef = useRef(uploadGroups);
	uploadGroupsRef.current = uploadGroups;

	const getAttachables = useCallback(
		async (query: string, signal?: AbortSignal): Promise<AttachmentGroup[]> => {
			const parts = query.replace(/^\//, "").split("/");
			const directory = parts.slice(0, -1);

			const groups: AttachmentGroup[] = [];

			// Walking into an upload the chat does not point into yet is exactly
			// the case a mount built from ids can answer: ask for that one too.
			const [tree, id] = directory;
			const mounted = FileUtils.mount({
				filesystem: filesystemRef.current,
				mount: PathUtils.mounts.find((name) => name === tree),
				id,
			});

			console.log("[useAttachments] mounted:", mounted);

			try {
				const entries = await client.api.file.getDirectory.query({
					...mounted,
					path: directory,
				});
				if (signal?.aborted) return groups;

				console.log("[useAttachments] mounted entries:", entries);

				groups.push({
					name: "Files",
					items: entries.map((entry) => ({
						name: entry.label ?? entry.name,
						label: entry.label ?? undefined,
						value: entry.uri,
						path: entry.path.join("/"),
						directory: entry.isDirectory,
						traversable: true,
					})),
				});
			} catch (error) {
				console.warn("[useAttachments] ailed to read mount files", error);
			}

			// Uploads stand outside the mount until something points into them, so
			// they are only offered while the query is still a bare name rather
			// than a path being walked down.
			if (!directory.length) groups.push(...uploadGroupsRef.current);

			if (!client.shell) return groups;

			const local = [
				...(query.startsWith("/") ? ["/"] : []),
				...directory,
			].join("/");

			try {
				let localFiles = await client.shell.readDir({ path: local || "." });
				if (signal?.aborted) return groups;

				// TODO: debounce, keep old paths visible while searching new
				const normalizedQuery = PathUtils.name(query).toLowerCase();
				if (
					!localFiles.find((file) =>
						PathUtils.name(file).toLowerCase().includes(normalizedQuery),
					)
				) {
					localFiles = await FileOperationService.searchNames({
						shell: client.shell,
						path: local || ".",
						query: PathUtils.name(query),
					});
				}

				return [
					...groups,
					{
						name: "Local",
						items: localFiles.map((file) => ({
							name: PathUtils.name(file),
							value: PathUtils.normalize(file),
							directory: file.is_dir,
							traversable: true,
						})),
					},
				];
			} catch (error) {
				console.warn("Failed to read local files", error);
				return groups;
			}
		},
		[client],
	);

	return { getAttachables };
};
