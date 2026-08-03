import { useAttachments } from "@tiny-chat/client/src/features/editor/hooks/useAttachments.ts";
import type {
	AttachmentGroup,
	AttachmentItem,
} from "@tiny-chat/client/src/features/editor/types/attachment.ts";
import type { CommandEdit } from "@tiny-chat/client/src/features/editor/types/command.ts";
import { AttachmentUtils } from "@tiny-chat/client/src/features/editor/utils/AttachmentUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useCallback, useEffect, useState } from "react";
import Completions from "./Completions.tsx";

export default function Attachments({
	content,
	setContent,
	cursor,
	setCursor,
}: {
	content: string;
	setContent: (content: string) => void;
	cursor: [row: number, column: number];
	setCursor: (cursor: [row: number, column: number]) => void;
}) {
	const { getAttachables } = useAttachments();

	const query = AttachmentUtils.query({ content, cursor });

	const [groups, setGroups] = useState<AttachmentGroup[]>([]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only re-fetch when the typed path changes
	useEffect(() => {
		if (!query) {
			setGroups([]);
			return;
		}

		const controller = new AbortController();

		getAttachables(query.text, controller.signal)
			.then((attachables) => {
				if (controller.signal.aborted) return;

				const other: AttachmentGroup = { name: "Other", items: [] };
				const hostname = PathUtils.hostname(query.text);
				if (hostname) {
					other.items.push({
						name: hostname,
						value: PathUtils.asWeb(query.text),
					});
				}

				setGroups([
					...AttachmentUtils.filter({ groups: attachables, query: query.text }),
					...(other.items.length > 0 ? [other] : []),
				]);
			})
			.catch((error) => {
				if (!controller.signal.aborted) {
					console.warn("Failed to get attachables", error);
				}
			});

		return () => controller.abort();
	}, [getAttachables, query?.text]);

	const apply = useCallback(
		(edit: CommandEdit | null) => {
			if (!edit) return false;
			setContent(edit.content);
			setCursor(edit.cursor);
			return true;
		},
		[setContent, setCursor],
	);

	if (!query) return null;

	return (
		<Completions<AttachmentGroup, AttachmentItem>
			groups={groups}
			renderItem={({ item }) => {
				return `${item.name}${item.directory ? "/" : ""}`;
			}}
			renderEmpty={() => {
				return "no matches";
			}}
			onInput={({ item, key }) => {
				if (key.return && item) {
					apply(AttachmentUtils.apply({ content, query, item }));
				}
				if (key.tab && item) {
					apply(AttachmentUtils.complete({ content, query, item }));
				}
			}}
			actions={[{ key: "tab", name: "fill" }]}
		/>
	);
}
