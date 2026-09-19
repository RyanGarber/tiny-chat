import { Text } from "@mantine/core";
import { ClientContext } from "@tiny-chat/client/src/client.ts";
import { useAttachments } from "@tiny-chat/client/src/features/editor/hooks/useAttachments.ts";
import { AttachmentService } from "@tiny-chat/client/src/features/editor/services/AttachmentService.ts";
import { useEditorPartStore } from "@tiny-chat/client/src/features/editor/stores/useEditorPartStore.ts";
import type { AttachmentItem } from "@tiny-chat/client/src/features/editor/types/attachment.ts";
import { AttachmentUtils } from "@tiny-chat/client/src/features/editor/utils/AttachmentUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { PluginKey } from "@tiptap/pm/state";
import { Node, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Suggestion } from "@tiptap/suggestion";
import { useCallback, useContext, useMemo } from "react";
import {
	type CompletionGroup,
	renderCompletions,
} from "#app/features/editor/components/Completions.tsx";
import { NodeUtils } from "#app/features/editor/utils/NodeUtils.ts";
import AttachmentView from "#app/features/part/components/Attachment.tsx";
import FileTag from "#app/features/upload/components/FileTag.tsx";

interface AttachmentGroup extends CompletionGroup<AttachmentItem> {
	items: AttachmentItem[];
}

interface AttachmentOptions {
	getAttachables: (
		query: string,
		signal?: AbortSignal,
	) => Promise<AttachmentGroup[]>;
	attach: (item: AttachmentItem) => Promise<string>;
}

const pluginKey = new PluginKey("attachment");

const Attachment = Node.create({
	name: "attachment",
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	isolating: true,
	draggable: true,
	extendNodeSchema() {
		return { disableDropCursor: true };
	},
	addOptions(): AttachmentOptions {
		return {
			getAttachables: async () => [],
			attach: async () => "",
		};
	},
	addAttributes() {
		return {
			id: {
				default: null,
				parseHTML(element) {
					return element.getAttribute("id");
				},
				renderHTML(attributes) {
					return { id: attributes.id };
				},
			},
		};
	},
	parseHTML() {
		return [{ tag: `attachment` }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["attachment", HTMLAttributes];
	},
	addNodeView() {
		return ReactNodeViewRenderer(
			({ node }) => <AttachmentNodeView id={node.attrs.id} />,
			{ as: "attachment", attrs: ({ node }) => node.attrs },
		);
	},
	...NodeUtils.createPointerDirective({
		nodeName: "attachment",
	}),
	addProseMirrorPlugins() {
		return [
			Suggestion<AttachmentGroup, AttachmentItem>({
				editor: this.editor,
				char: "@",
				pluginKey,
				allowToIncludeChar: true,
				placement: "top-start",
				items: async ({ query, signal }) => {
					const items = await (
						this.options as AttachmentOptions
					).getAttachables(query, signal);
					const other: AttachmentGroup = {
						name: "Other",
						items: [],
					};

					if (PathUtils.hostname(query)) {
						other.items.push({
							name: PathUtils.hostname(query),
							value: PathUtils.asWeb(query),
						});
					}

					const search = query.split("/").at(-1)?.trim().toLowerCase();

					const include = (item: AttachmentItem) => {
						return (
							(!search || item.name?.toLowerCase().includes(search)) &&
							(!query.includes("/") || item.traversable)
						);
					};

					return [
						...items.map((group) => ({
							...group,
							items: group.items.filter(include),
						})),
						other,
					];
				},
				command: ({ editor, range, props }) => {
					void (this.options as AttachmentOptions).attach(props).then((id) => {
						editor
							.chain()
							.focus()
							.insertContentAt(range, [
								{ type: "text", text: " " },
								{ type: this.name, attrs: { id } },
								{ type: "text", text: " " },
							])
							.run();
					});
				},
				render: renderCompletions({
					renderEmpty: () => "No matches",
					renderItem: (item) => {
						return (
							<FileTag
								path={item.value}
								directory={item.directory}
								miw={0}
								wrap="nowrap"
								viewable={false}
							>
								<Text
									size="sm"
									style={{
										overflow: "hidden",
										whiteSpace: "nowrap",
										textOverflow: "ellipsis",
									}}
								>{`${item.name}${item.directory ? "/" : ""}`}</Text>
							</FileTag>
						);
					},
					onTab: ({ item, editor, range }) => {
						const existing = editor.$doc.content
							.textBetween(range.from, range.to, "\n", "\n")
							.replace(/^@/, "");
						editor
							.chain()
							.focus()
							.insertContentAt(
								range,
								`@${AttachmentUtils.continued({ query: existing, item })}`,
							)
							.run();
					},
				}),
			}),
		];
	},
});

export const useAttachment = () => {
	const client = useContext(ClientContext);
	const { getAttachables } = useAttachments();
	const attach = useCallback(
		async (item: AttachmentItem) =>
			(await AttachmentService.create({ client, item })).id,
		[client],
	);

	return useMemo(
		() =>
			Attachment.configure({
				getAttachables,
				attach,
			} satisfies AttachmentOptions),
		[getAttachables, attach],
	);
};

function AttachmentNodeView({ id }: { id: string }) {
	const attachment = useEditorPartStore((state) => state.parts[id]);
	if (attachment?.type !== "attachment") return null;
	return (
		<NodeViewWrapper as="span" contentEditable={false} data-drag-handle>
			<AttachmentView
				source={attachment.source}
				directory={attachment.content.type === "directory"}
				name={attachment.label}
				grabbable
			/>
		</NodeViewWrapper>
	);
}
