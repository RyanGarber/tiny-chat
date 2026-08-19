import { Group, Image, Text } from "@mantine/core";
import { useAttachments } from "@tiny-chat/client/src/features/editor/hooks/useAttachments.ts";
import type { AttachmentItem } from "@tiny-chat/client/src/features/editor/types/attachment.ts";
import { AttachmentUtils } from "@tiny-chat/client/src/features/editor/utils/AttachmentUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { PluginKey } from "@tiptap/pm/state";
import { Node, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Suggestion } from "@tiptap/suggestion";
import { useMemo } from "react";
import { theme } from "#app/core/utils/IconUtils.ts";
import {
	type CompletionGroup,
	renderCompletions,
} from "#app/features/editor/components/Completions.tsx";
import { NodeUtils } from "#app/features/editor/utils/NodeUtils.ts";
import AttachmentView from "#app/features/part/components/Attachment.tsx";

interface AttachmentGroup extends CompletionGroup<AttachmentItem> {
	items: AttachmentItem[];
}

interface AttachmentOptions {
	getAttachables: (
		query: string,
		signal?: AbortSignal,
	) => Promise<AttachmentGroup[]>;
}

const pluginKey = new PluginKey("attachment");

const Attachment = Node.create({
	name: "attachment",
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	draggable: true,
	isolating: true,
	addOptions(): AttachmentOptions {
		return {
			getAttachables: async () => [],
		};
	},
	addAttributes() {
		return {
			source: {
				default: null,
				parseHTML(element) {
					return element.getAttribute("source");
				},
				renderHTML(attributes) {
					return { source: attributes.source };
				},
			},
			"is-directory": {
				default: false,
				parseHTML(element) {
					return element.getAttribute("is-directory");
				},
				renderHTML(attributes) {
					return { "is-directory": attributes["is-directory"] };
				},
			},
			// What the attachment reads as when its path does not say — an upload
			// is mounted under its id, so it travels under the name it was
			// attached as.
			name: {
				default: null,
				parseHTML(element) {
					return element.getAttribute("name");
				},
				renderHTML(attributes) {
					return attributes.name ? { name: attributes.name } : {};
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
			({ node }) => (
				<NodeViewWrapper as="span" contentEditable={false} data-drag-handle>
					<AttachmentView
						source={node.attrs.source}
						directory={node.attrs["is-directory"] === "true"}
						name={node.attrs.name ?? undefined}
						grabbable
					/>
				</NodeViewWrapper>
			),
			{ as: "attachment", attrs: ({ node }) => node.attrs },
		);
	},
	...NodeUtils.createInlineDirective({
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
					editor
						.chain()
						.focus()
						.insertContentAt(range, [
							{ type: "text", text: " " },
							{
								type: this.name,
								attrs: {
									source: props.value,
									"is-directory": props.directory ? "true" : "false",
									...(props.label ? { name: props.label } : {}),
								},
							},
							{ type: "text", text: " " },
						])
						.run();
				},
				render: renderCompletions({
					renderEmpty: () => "No matches",
					renderItem: (item) => {
						const iconId = !item.directory
							? theme?.getFileIconId(item.value, undefined, false)
							: theme?.getFolderIconId(item.value, false, false);
						const icon = iconId
							? theme?.getIconContent(iconId, "base64")
							: null;
						return (
							<Group gap={5} miw={0} wrap="nowrap">
								{icon && (
									<Image
										src={`data:${icon.mimeType};base64,${icon.data}`}
										alt={item.name}
										w="auto"
										h={20}
									/>
								)}
								<Text
									size="sm"
									style={{
										overflow: "hidden",
										whiteSpace: "nowrap",
										textOverflow: "ellipsis",
									}}
								>{`${item.name}${item.directory ? "/" : ""}`}</Text>
							</Group>
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
	const { getAttachables } = useAttachments();

	return useMemo(
		() => Attachment.configure({ getAttachables } satisfies AttachmentOptions),
		[getAttachables],
	);
};
