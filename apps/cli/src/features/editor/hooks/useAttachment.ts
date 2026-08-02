import { useAttachments } from "@tiny-chat/client/src/features/editor/hooks/useAttachments.ts";
import type { AttachmentGroup } from "@tiny-chat/client/src/features/editor/types/attachment.ts";
import type { CommandEdit } from "@tiny-chat/client/src/features/editor/types/command.ts";
import { AttachmentUtils } from "@tiny-chat/client/src/features/editor/utils/AttachmentUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { useCallback, useEffect, useState } from "react";

export const useAttachment = ({
	content,
	setContent,
	cursor,
	setCursor,
}: {
	content: string;
	setContent: (content: string) => void;
	cursor: [row: number, column: number];
	setCursor: (cursor: [row: number, column: number]) => void;
}) => {
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

	const count = groups.reduce((total, group) => total + group.items.length, 0);

	const [selected, setSelected] = useState(0);
	const index = Math.min(selected, Math.max(count - 1, 0));

	// biome-ignore lint/correctness/useExhaustiveDependencies: a new query starts at the top
	useEffect(() => {
		setSelected(0);
	}, [query?.text]);

	const move = useCallback(
		(offset: number) => {
			setSelected((previous) =>
				Math.min(Math.max(previous + offset, 0), Math.max(count - 1, 0)),
			);
		},
		[count],
	);

	const apply = useCallback(
		(edit: CommandEdit | null) => {
			if (!edit) return false;
			setContent(edit.content);
			setCursor(edit.cursor);
			return true;
		},
		[setContent, setCursor],
	);

	/**
	 * Take the highlighted attachment: finalize it as a directive, or
	 * continue traversing into it when completing. Returns false when the
	 * input should be handled as regular text instead.
	 */
	const select = useCallback(
		({ complete }: { complete?: boolean } = {}) => {
			if (!query) return false;

			const item = groups.flatMap((group) => group.items)[index];
			if (!item) return false;

			return apply(
				complete
					? AttachmentUtils.complete({ content, query, item })
					: AttachmentUtils.apply({ content, query, item }),
			);
		},
		[apply, content, groups, index, query],
	);

	return {
		groups,
		selected: index,
		/** whether the attachment being typed owns the input's keys */
		isAttaching: !!query,
		move,
		select,
	};
};
