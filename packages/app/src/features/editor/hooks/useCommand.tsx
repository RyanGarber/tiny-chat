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
import { AppService } from "#app/core/services/AppService.ts";
import { renderCompletions } from "#app/features/editor/components/Completions.tsx";
import { NodeUtils } from "#app/features/editor/utils/NodeUtils.ts";

interface CommandOptions {
	getCommands: () => CommandGroup[];
}

const nodeName = "command";
const pluginKey = new PluginKey("command");
const pluginKeyChoices = new PluginKey("command-choices");

const Command = Node.create({
	name: nodeName,
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
		nodeName: nodeName,
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
					applyCommand(editor, props, range);
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
						editor.chain().focus().deleteNode(nodeName).run();
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

				this.editor.chain().focus().deleteNode(nodeName).run();
				return true;
			},
			Space: () => {
				const range = this.editor.state.selection;
				if (range.from !== range.to) return false;

				const { isCompletionsOpen } = useCompletionStore.getState();
				if (!isCompletionsOpen) return false;

				const { node } = this.editor.state.doc.childBefore(range.to);
				const text = node?.textContent?.split(" ").at(-1);
				if (!text) return false;

				const commands = (this.options as CommandOptions)
					.getCommands()
					.flatMap((group) => group.items);
				const command = commands.find((command) => `/${command.name}` === text);
				if (!command) return false;

				applyCommand(this.editor, command, {
					from: range.to - 1 - text.length,
					to: range.to,
				});
				return true;
			},
		};
	},
});

export const useCommand = () => {
	const { getCommands } = useCommands({
		onOpenTools: () => AppService.openCapabilities("tools:native"),
		onOpenSkills: () => AppService.openCapabilities("skills:native"),
	});

	return useMemo(
		() => Command.configure({ getCommands } satisfies CommandOptions),
		[getCommands],
	);
};

function applyCommand(editor: Editor, command: CommandItem, range: Range) {
	const nodes = getCommandNodes(editor);
	const end = nodes.at(-1)?.range.to ?? 0;
	const acceptsContent = CommandUtils.acceptsContent(command);
	const focus = end + (acceptsContent ? 3 : 6);

	if (!acceptsContent && CommandUtils.run({ command })) {
		editor.chain().focus().deleteRange(range).run();
		return;
	}

	editor
		.chain()
		.focus()
		.deleteRange(range)
		.insertContentAt(end + 1, [
			{
				type: nodeName,
				attrs: {
					name: command.name,
					value: command.value,
					"accepts-content": acceptsContent ? "true" : "false",
					"needs-run": CommandUtils.needsRun(command) ? "true" : "false",
				},
				// awful hidden zero-width hack to fix prosemirror fuckery
				content: [{ type: "text", text: "\u200B\u200B" }],
			},
			{ type: "text", text: " " },
		])
		.setTextSelection({ from: focus, to: focus })
		.run();
}

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
