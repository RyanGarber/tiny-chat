import { MessagingService } from "@tiny-chat/client/src/features/chat/services/MessagingService.ts";
import type {
	CompletionGroup,
	CompletionItem,
} from "@tiny-chat/client/src/features/editor/types/completion.ts";
import { useUploads } from "@tiny-chat/client/src/features/upload/hooks/useUploads.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { useMemo } from "react";
import { client } from "../../../client.ts";
import Text from "../../../core/components/Text.tsx";
import { usePage } from "../../../core/hooks/usePage.ts";
import { useSentinel } from "../../../core/hooks/useSentinel.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Completions from "../../editor/components/Completions.tsx";

interface UploadItem extends CompletionItem {
	detail?: string;
	attach: () => void;
	remove: () => void;
}

/**
 * The files already uploaded, which the next message can be sent with.
 *
 * An upload is attached by referencing its directory on the chat mount, so
 * picking one writes that reference into the editor — the same attachment `@`
 * writes, reached from a list of what has been uploaded rather than by name.
 */
export default function Uploads() {
	const { attachmentUploads, deleteUpload } = useUploads();
	useWorkingStatus(attachmentUploads, deleteUpload);

	const { setPage } = usePage();

	// Older uploads are appended below the list, so reaching the bottom is what
	// asks for the next page.
	const fetchOlder = useSentinel(attachmentUploads);

	const uploads = useMemo(
		() => attachmentUploads.data?.pages.flatMap((page) => page.uploads) ?? [],
		[attachmentUploads.data],
	);

	const groups = useMemo((): CompletionGroup<UploadItem>[] => {
		return [
			{
				items: uploads.map((upload) => ({
					name: upload.name,
					value: upload.id,
					detail: CommonUtils.formatDate({
						date: upload.createdAt,
						relative: true,
					}),
					attach: () => {
						MessagingService.attachUpload({ client, upload });
						setPage("chat");
					},
					remove: () => {
						deleteUpload.mutate({ id: upload.id });
					},
				})),
			},
		];
	}, [uploads, deleteUpload, setPage]);

	return (
		<Completions<CompletionGroup<UploadItem>, UploadItem>
			groups={groups}
			renderItem={({ item }) => {
				return (
					<Text>
						{item.name}
						<Text color="textSubtle">
							{item.detail ? ` · ${item.detail}` : ""}
						</Text>
					</Text>
				);
			}}
			renderEmpty={() => "nothing here yet"}
			onInput={({ item, key, input }) => {
				if ((key.return || input === " ") && item) item.attach();
				if (input === "d" && item) item.remove();
			}}
			actions={[{ key: "d", name: "delete" }, "back"]}
			selectFirstOnChange={false}
			onReachBottom={fetchOlder}
		/>
	);
}
