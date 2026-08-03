import { useCommands } from "@tiny-chat/client/src/features/editor/hooks/useCommands.ts";
import { useCompletionStore } from "@tiny-chat/client/src/features/editor/stores/useCompletionStore.ts";
import type {
	CommandChoiceGroup,
	CommandChoiceItem,
	CommandGroup,
	CommandItem,
} from "@tiny-chat/client/src/features/editor/types/command.ts";
import { CommandUtils } from "@tiny-chat/client/src/features/editor/utils/CommandUtils.ts";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import {
	type Editor,
	Node,
	NodeViewContent,
	NodeViewWrapper,
	type Range,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { Suggestion } from "@tiptap/suggestion";
import { useMemo } from "react";
import { Command as CommandView } from "#app/core/components/Components.tsx";
import { useCapabilitySelectStore } from "#app/features/agent/stores/useCapabilitySelectStore.ts";
import { renderCompletions } from "#app/features/editor/components/Completions.tsx";
import { NodeUtils } from "#app/features/editor/utils/NodeUtils.ts";

interface CommandOptions {
	getCommands: () => CommandGroup[];
}

const pluginKey = new PluginKey("command");
const pluginKeyChoices = new PluginKey("command-choices");

const Command = Node.create({
	name: "command",
	group: "inline",
	content: "inline*",
	inline: true,
	isolating: false,
	selectable: true,
	draggable: false,
	addOptions(): CommandOptions {
		return {
			getCommands: () => [],
		};
	},
	addAttributes() {
		return {
			name: {
				default: null,
				parseHTML(element) {
					return element.getAttribute("name");
				},
				renderHTML(attributes) {
					return { name: attributes.name };
				},
			},
			value: {
				default: null,
				parseHTML(element) {
					return element.getAttribute("value");
				},
				renderHTML(attributes) {
					return { value: attributes.value };
				},
			},
			"accepts-content": {
				default: null,
				parseHTML(element) {
					return element.getAttribute("accepts-content");
				},
				renderHTML(attributes) {
					return { "accepts-content": attributes["accepts-content"] };
				},
			},
			"needs-run": {
				default: null,
				parseHTML(element) {
					return element.getAttribute("needs-run");
				},
				renderHTML(attributes) {
					return { "needs-run": attributes["needs-run"] };
				},
			},
		};
	},
	parseHTML() {
		return [{ tag: `command` }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["command", HTMLAttributes, 0];
	},
	addNodeView() {
		return ReactNodeViewRenderer(
			({ node }) => {
				return (
					<NodeViewWrapper as="span">
						<CommandView
							name={node.attrs.name}
							content={
								node.attrs["accepts-content"] === "true" ? (
									<NodeViewContent />
								) : undefined
							}
						/>
					</NodeViewWrapper>
				);
			},
			{ as: "command", attrs: ({ node }) => node.attrs },
		);
	},
	...NodeUtils.createInlineDirective({
		nodeName: "command",
	}),
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("command-fix"),
				appendTransaction: (transactions, _oldState, newState) => {
					const docChanged = transactions.some(
						(transaction) => transaction.docChanged,
					);
					if (!docChanged) return null;

					let tr: Transaction | null = null;
					newState.doc.descendants((node, pos) => {
						if (node.type.name !== "command") return true;
						if (node.attrs["accepts-content"] !== "true") return true;
						if (node.textContent.length > 1) return true;
						if (!tr) tr = newState.tr;
						tr.deleteRange(pos, pos + node.nodeSize);
					});

					return tr;
				},
			}),
			Suggestion<CommandGroup, CommandItem>({
				editor: this.editor,
				char: "/",
				pluginKey,
				placement: "top-start",
				allow: ({ editor }) => {
					const { command } = getSelectedCommandNode(
						editor,
						(this.options as CommandOptions).getCommands(),
					);
					return command?.choices === undefined;
				},
				items: async ({ editor, query }) =>
					CommandUtils.filter({
						groups: (this.options as CommandOptions).getCommands(),
						query,
						used: getCommandNodes(editor).map(({ node }) => node.attrs.value),
					}),
				render: renderCompletions({
					renderEmpty: () => "No matches",
					renderItem: (item) => `/${item.name}`,
					onTab: ({ item, editor, range }) => {
						editor
							.chain()
							.focus()
							.insertContentAt(range, `/${item.name}`)
							.run();
						return true;
					},
				}),
				command: ({ editor, props, range }) => {
					const nodes = getCommandNodes(editor);
					const end = nodes.at(-1)?.range.to ?? 0;
					const acceptsContent = CommandUtils.acceptsContent(props);
					const focus = end + (acceptsContent ? 3 : 6);

					if (!acceptsContent && CommandUtils.run({ command: props })) {
						editor.chain().focus().deleteRange(range).run();
						return;
					}

					editor
						.chain()
						.focus()
						.deleteRange(range)
						.insertContentAt(end + 1, [
							{
								type: this.name,
								attrs: {
									name: props.name,
									value: props.value,
									"accepts-content": acceptsContent ? "true" : "false",
									"needs-run": CommandUtils.needsRun(props) ? "true" : "false",
								},
								// awful hidden zero-width hack to fix prosemirror fuckery
								content: [{ type: "text", text: "\u200B\u200B" }],
							},
							{ type: "text", text: " " },
						])
						.setTextSelection({ from: focus, to: focus })
						.run();
				},
			}),
			Suggestion<CommandChoiceGroup, CommandChoiceItem>({
				editor: this.editor,
				char: "\u200B",
				pluginKey: pluginKeyChoices,
				placement: "top-start",
				allow: ({ editor }) => {
					const { command } = getSelectedCommandNode(
						editor,
						(this.options as CommandOptions).getCommands(),
					);
					return command?.choices !== undefined;
				},
				items: async ({ editor, query }) => {
					const { command } = getSelectedCommandNode(
						editor,
						(this.options as CommandOptions).getCommands(),
					);
					return CommandUtils.filterChoices({
						command,
						query: query.replaceAll("\u200B", ""),
					});
				},
				render: renderCompletions({
					renderEmpty: () => "No matches",
					renderItem: (item) => item.name,
					onTab: ({ item, editor, range }) => {
						editor
							.chain()
							.focus()
							.insertContentAt(range, `\u200B${item.name}\u200B`)
							.setTextSelection(range.from + 1 + (item.name?.length ?? 0))
							.run();
						return true;
					},
				}),
				command: ({ editor, props }) => {
					const { command } = getSelectedCommandNode(
						editor,
						(this.options as CommandOptions).getCommands(),
					);
					if (!command) {
						return;
					}

					if (CommandUtils.runChoice({ command, choice: props })) {
						editor.chain().focus().deleteNode(this.name).run();
					}
					// TODO - apply choice value?
				},
			}),
		];
	},
	addKeyboardShortcuts() {
		return {
			Enter: () => {
				const { command, commandNode } = getSelectedCommandNode(
					this.editor,
					(this.options as CommandOptions).getCommands(),
				);
				if (!command || !commandNode) {
					return false;
				}

				const { isCompletionsOpen, isCompletionsEmpty } =
					useCompletionStore.getState();
				if (isCompletionsOpen && !isCompletionsEmpty) {
					return false;
				}

				const value = commandNode.textContent.replace(/[\s\u200B]/g, "");
				if (!CommandUtils.run({ command, value })) {
					return false;
				}

				this.editor.chain().focus().deleteNode(this.name).run();
				return true;
			},
		};
	},
});

export const useCommand = () => {
	const openCapabilitySelect = useCapabilitySelectStore((s) => s.open);
	const { getCommands } = useCommands({
		onOpenTools: () => openCapabilitySelect("tools:built-in"),
		onOpenSkills: () => openCapabilitySelect("skills:built-in"),
	});

	return useMemo(
		() => Command.configure({ getCommands } satisfies CommandOptions),
		[getCommands],
	);
};

function getCommandNodes(editor: Editor) {
	const nodes: {
		node: ProseMirrorNode;
		range: Range;
	}[] = [];
	editor.state.doc.descendants((node, pos) => {
		if (node.type.name === "command") {
			nodes.push({
				node,
				range: { from: pos, to: pos + node.nodeSize },
			});
		}
	});
	return nodes;
}

function getSelectedCommandNode(editor: Editor, groups: CommandGroup[]) {
	const { $from } = editor.state.selection;
	let commandNode: ProseMirrorNode | null = null;
	for (let depth = $from.depth; depth >= 0; depth--) {
		const node = $from.node(depth);

		if (node.type.name === "command") {
			commandNode = node;
			break;
		}
	}
	const command = CommandUtils.find({
		groups,
		name: commandNode?.attrs.name,
	});
	return { command, commandNode };
}

export function hasPendingCommandNode(editor: Editor) {
	const nodes = getCommandNodes(editor);
	return nodes.some(({ node }) => node.attrs["needs-run"] === "true");
}
