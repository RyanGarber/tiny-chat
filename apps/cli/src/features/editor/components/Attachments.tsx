import { useAttachments } from "@tiny-chat/client/features/editor/hooks/useAttachments.ts";
import { AttachmentService } from "@tiny-chat/client/features/editor/services/AttachmentService.ts";
import type {
	AttachmentGroup,
	AttachmentItem,
} from "@tiny-chat/client/features/editor/types/attachment.ts";
import type { CommandEdit } from "@tiny-chat/client/features/editor/types/command.ts";
import { AttachmentUtils } from "@tiny-chat/client/features/editor/utils/AttachmentUtils.ts";
import { PathUtils } from "@tiny-chat/core/features/file/utils/PathUtils.ts";
import { useCallback, useEffect, useState } from "react";
import { client } from "../../../client.ts";
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

	// Keyed on the text alone: the query is rebuilt every render, and a search
	// that re-ran on each one would restart itself with every result it set.
	const text = query?.text;
	useEffect(() => {
		if (text === undefined) return;

		const controller = new AbortController();

		getAttachables(text, controller.signal)
			.then((attachables) => {
				if (controller.signal.aborted) return;

				const other: AttachmentGroup = { name: "Other", items: [] };
				const hostname = PathUtils.hostname(text);
				if (hostname) {
					other.items.push({
						name: hostname,
						value: PathUtils.asWeb(text),
					});
				}

				setGroups([
					...AttachmentUtils.filter({ groups: attachables, query: text }),
					...(other.items.length > 0 ? [other] : []),
				]);
			})
			.catch((error) => {
				if (!controller.signal.aborted) {
					console.warn("Failed to get attachables", error);
				}
			});

		return () => controller.abort();
	}, [getAttachables, text]);

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
					void AttachmentService.create({ client, item })
						.then((node) =>
							apply(AttachmentUtils.apply({ content, query, node })),
						)
						.catch((error) => console.warn("Failed to attach item", error));
				}
				if (key.tab && item) {
					apply(AttachmentUtils.complete({ content, query, item }));
				}
			}}
			actions={[{ key: "tab", name: "fill" }, "select"]}
		/>
	);
}
