import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useCallback, useContext, useRef } from "react";
import { ClientProvider } from "../../../client.ts";
import { useChatFiles } from "../../chat/hooks/useChatFiles.ts";
import type { AttachmentGroup } from "../types/attachment.ts";

/**
 * Build the attachments available to any client: files already in this chat,
 * plus files on the local machine when the client can read the filesystem.
 */
export const useAttachments = () => {
	const client = useContext(ClientProvider);

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
					name: "This Chat",
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
				const pcFiles = await client.shell.readDir({
					path: path.join("/") || ".",
				});
				if (signal?.aborted) return groups;
				return [
					...groups,
					{
						name: "This PC",
						items: pcFiles.map((file) => ({
							name: PathUtils.name(file),
							value: PathUtils.normalize(file),
							directory: file.is_dir,
							traversable: true,
						})),
					},
				];
			} catch (error) {
				console.warn("Failed to read PC files", error);
				return groups;
			}
		},
		[client],
	);

	return { getAttachables };
};
