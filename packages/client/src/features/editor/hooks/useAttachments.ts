import { FileOperationService } from "@tiny-chat/core/src/features/file/services/FileOperationService.ts";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useCallback, useContext, useRef } from "react";
import { ClientContext } from "../../../client.ts";
import { useChatFiles } from "../../chat/hooks/useChatFiles.ts";
import type { AttachmentGroup } from "../types/attachment.ts";

/**
 * Build the attachments available to any client: files already in this chat,
 * plus files on the local machine when the client can read the filesystem.
 */
export const useAttachments = () => {
	const client = useContext(ClientContext);

	const { chatFiles } = useChatFiles();
	const chatFilesRef = useRef(chatFiles);
	chatFilesRef.current = chatFiles;

	const getAttachables = useCallback(
		async (query: string, signal?: AbortSignal): Promise<AttachmentGroup[]> => {
			let path: string[] | undefined;
			path = query?.replace(/^\//, "").split("/");
			path = path?.slice(0, -1);
			path = [...(query?.startsWith("/") ? ["/"] : []), ...path];

			const chatFiles = chatFilesRef.current;
			const chatFileMap = FileUtils.toMap({ nodes: chatFiles.data ?? [] });

			const groups: AttachmentGroup[] = [
				{
					name: "Chat",
					items: Array.from(chatFileMap.entries())
						.filter(([file]) =>
							PathUtils.contains({ child: file, parent: path }),
						)
						.map(([path, { node }]) => {
							return {
								name: PathUtils.name({ path }),
								value: node?.uri ?? PathUtils.toMount({ path }),
								directory: !node,
								traversable: true,
							};
						}),
				},
			];

			if (!client.shell) return groups;

			try {
				let localFiles = await client.shell.readDir({
					path: path.join("/") || ".",
				});
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
						path: path.join("/") || ".",
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
