import { Group, Image, Text } from "@mantine/core";
import { FileUtils } from "@tiny-chat/core/src/features/file/utils/FileUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import { PluginKey } from "@tiptap/pm/state";
import { Node, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Suggestion } from "@tiptap/suggestion";
import { useMemo, useRef } from "react";
import { Attachment as AttachmentView } from "#ui/core/components/Components.tsx";
import { useTauri } from "#ui/core/hooks/useTauri.ts";
import { useFilesystem } from "#ui/features/file/hooks/useFilesystem.ts";
import {
	type CompletionGroup,
	type CompletionItem,
	renderCompletions,
} from "#ui/features/input/components/Completions.tsx";
import { TauriUtils } from "#ui/features/tauri/utils/TauriUtils.ts";
import { theme } from "#ui/utils/icon.ts";
import { createInlineDirective } from "#ui/utils/tiptap.ts";

interface AttachmentItem extends CompletionItem {
	directory?: boolean;
	traversable?: boolean;
}

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
						grabbable
					/>
				</NodeViewWrapper>
			),
			{ as: "attachment", attrs: ({ node }) => node.attrs },
		);
	},
	...createInlineDirective({
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
							<Group gap={5}>
								{icon && (
									<Image
										src={`data:${icon.mimeType};base64,${icon.data}`}
										alt={item.name}
										w="auto"
										h={20}
									/>
								)}
								<Text size="sm">{`${item.name}${item.directory ? "/" : ""}`}</Text>
							</Group>
						);
					},
					onTab: ({ item, editor, range }) => {
						const name = `${item.name}${item.directory ? "/" : ""}`;
						const existing = editor.$doc.content.textBetween(
							range.from,
							range.to,
							"\n",
							"\n",
						);
						editor
							.chain()
							.focus()
							.insertContentAt(
								range,
								`@${existing.replace(/^@/, "").replace(/([^/]+)?$/, name)}`,
							)
							.run();
					},
				}),
			}),
		];
	},
});

export const useAttachment = () => {
	const { chatFiles } = useFilesystem();
	const chatFilesRef = useRef(chatFiles);
	chatFilesRef.current = chatFiles;

	const { isTauriDesktop } = useTauri();
	const isTauriDesktopRef = useRef(isTauriDesktop);
	isTauriDesktopRef.current = isTauriDesktop;

	return useMemo(
		() =>
			Attachment.configure({
				async getAttachables(query, signal) {
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

					if (!isTauriDesktopRef.current) return groups;

					try {
						const pcFiles = await TauriUtils.invoke<
							{ path: string; is_dir: boolean }[]
						>("read_dir", {
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
			} satisfies AttachmentOptions),
		[],
	);
};
