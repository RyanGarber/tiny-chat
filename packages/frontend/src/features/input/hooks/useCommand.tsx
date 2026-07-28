import { useCallbackRef } from "@mantine/hooks";
import {
	DEFAULT_SKILLS,
	DEFAULT_TOOLSETS,
} from "@tiny-chat/shared/src/features/data/types/message.ts";
import type { ModelProviderStatus } from "@tiny-chat/shared/src/features/provider/types/model";
import type { ProviderState } from "@tiny-chat/shared/src/features/provider/types/provider";
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
import { useCallback, useMemo, useRef } from "react";
import { Command as CommandView } from "#frontend/core/components/Components.tsx";
import { useConfig } from "#frontend/features/config/hooks/useConfig.ts";
import { useProviders } from "#frontend/features/config/hooks/useProviders.ts";
import { useSkills } from "#frontend/features/file/hooks/useSkills.ts";
import {
	type CompletionGroup,
	type CompletionItem,
	renderCompletions,
} from "#frontend/features/input/components/Completions.tsx";
import { useCompletionsStore } from "#frontend/features/input/stores/useCompletionsStore.ts";
import { usePresets } from "#frontend/features/settings/hooks/usePresets.ts";
import { createInlineDirective } from "#frontend/utils/tiptap.ts";

interface CommandChoiceItem extends CompletionItem {
	run?: (command: CommandItem) => unknown;
}

interface CommandChoiceGroup extends CompletionGroup<CommandChoiceItem> {}

interface CommandItem extends CompletionItem {
	choices?: CommandChoiceGroup[];
	dynamic?: boolean;
	run?: (value?: string) => unknown;
}

interface CommandGroup extends CompletionGroup<CommandItem> {
	max?: number;
}

interface CommandOptions {
	getCommands: (query: string) => CommandGroup[];
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
	...createInlineDirective({
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
						(this.options as CommandOptions).getCommands(""),
					);
					return command?.choices === undefined;
				},
				items: async ({ editor, query }) => {
					const groups = (this.options as CommandOptions).getCommands(query);

					const include = (item: CommandItem, group: CommandGroup) => {
						const existing = getCommandNodes(editor);
						const existingInGroup = existing.filter(({ node }) =>
							group.items.some((i) => i.value === node.attrs.value),
						);
						return (
							groups
								.flatMap((group) => group.items)
								.filter((other) => other.value === item.value).length === 1 &&
							!existing.some(({ node }) => node.attrs.value === item.value) &&
							(!group.max || existingInGroup.length < group.max) &&
							item.name?.includes(query.toLowerCase())
						);
					};

					return groups
						.filter(
							(group) =>
								group.items.filter((item) => include(item, group)).length,
						)
						.map((group) => ({
							...group,
							items: group.items.filter((item) => include(item, group)),
						}));
				},
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
					const focus = end + (props.choices || props.dynamic ? 3 : 6);

					if (props.run && !props.choices && !props.dynamic) {
						void props.run();
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
									"accepts-content":
										props.choices || props.dynamic ? "true" : "false",
									"needs-run":
										props.run ||
										props.choices
											?.flatMap((choice) => choice.items)
											.some((item) => !!item.run)
											? "true"
											: "false",
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
						(this.options as CommandOptions).getCommands(""),
					);
					return command?.choices !== undefined;
				},
				items: async ({ editor, query }) => {
					const { command } = getSelectedCommandNode(
						editor,
						(this.options as CommandOptions).getCommands(""),
					);
					if (!command?.choices) return [];
					return command.choices.map((group) => ({
						...group,
						items: group.items.filter((item) =>
							item.name
								?.toLowerCase()
								.includes(query.toLowerCase().replaceAll("\u200B", "")),
						),
					}));
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
						(this.options as CommandOptions).getCommands(""),
					);
					if (!command) {
						return;
					}

					if (command?.run || props.run) {
						command?.run?.(props.name);
						props.run?.(command);
						editor.chain().focus().deleteNode(this.name).run();
						return;
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
					(this.options as CommandOptions).getCommands(""),
				);
				if (!command || !commandNode) {
					return false;
				}

				const { isCompletionsOpen, isCompletionsEmpty } =
					useCompletionsStore.getState();
				if (isCompletionsOpen && !isCompletionsEmpty) {
					return false;
				}

				const content = commandNode.textContent.replace(/[\s\u200B]/g, "");
				const choice = command.choices
					?.flatMap((group) => group.items)
					.find((item) => item.name === content);

				if ((command?.dynamic || choice) && (command.run || choice?.run)) {
					command.run?.(content);
					choice?.run?.(command);
					this.editor.chain().focus().deleteNode(this.name).run();
					return true;
				}

				return false;
			},
		};
	},
});

export const useCommand = () => {
	const { providers } = useProviders();
	const { skills } = useSkills();
	const { config, setConfig, modelArgs, setModelArg } = useConfig();
	const { presets, setPreset, unsetPreset } = usePresets();

	const providersRef = useRef(providers.data);
	providersRef.current = providers.data;

	const configRef = useRef(config);
	configRef.current = config;
	const setConfigRef = useCallbackRef(setConfig);

	const modelArgsRef = useRef(modelArgs);
	modelArgsRef.current = modelArgs;
	const setModelArgRef = useCallbackRef(setModelArg);

	const presetsRef = useRef(presets);
	presetsRef.current = presets;
	const setPresetRef = useRef(setPreset);
	setPresetRef.current = setPreset;
	const unsetPresetRef = useRef(unsetPreset);
	unsetPresetRef.current = unsetPreset;

	const skillsRef = useRef(skills);
	skillsRef.current = skills;

	const getCommands = useCallback((): CommandGroup[] => {
		const models: CommandChoiceGroup[] =
			providersRef.current
				?.filter(
					(provider): provider is ProviderState<ModelProviderStatus> =>
						provider.type === "model",
				)
				.map((provider) => ({
					name: provider.name,
					items: provider.status.models.map((model) => ({
						name: model.name,
						value: model.name,
						active:
							configRef.current.provider === provider.name &&
							configRef.current.model === model.name,
						run: () =>
							setConfigRef({
								provider: provider.name,
								model: model.name,
								args: {},
								toolsets: configRef.current.toolsets ?? DEFAULT_TOOLSETS,
								skills: configRef.current.skills ?? DEFAULT_SKILLS,
							}),
					})),
				})) ?? [];

		const modelArgs: CommandItem[] = modelArgsRef.current.flatMap((arg) => {
			if (arg.type === "list") {
				return {
					name: arg.name,
					value: arg.name,
					choices: [
						{
							items: arg.values.map((value) => ({
								name: value,
								value,
								active:
									configRef.current.args?.[arg.name] === value ||
									(!configRef.current.args?.[arg.name] &&
										arg.default === value),
								run: () => setModelArgRef(arg.name, value),
							})),
						},
					],
				};
			} else if (arg.type === "range") {
				return {
					name: arg.name,
					value: arg.name,
					dynamic: true,
					run: (value) => {
						if (!value) return;
						const int = Number(value);
						if (!Number.isInteger(int)) return;
						if (int < arg.min || int > arg.max) return;
						setModelArgRef(arg.name, int);
					},
				};
			}
			return [];
		});

		const presets: CommandChoiceGroup[] = [
			{
				items: Object.entries(presetsRef.current.data ?? {}).map(
					([name, preset]) => ({
						name,
						value: name,
						run: (command) => {
							if (command.name === "preset") {
								setConfigRef(preset);
							} else if (command.name === "unset-preset") {
								unsetPresetRef.current.mutate({
									name,
								});
							}
						},
					}),
				),
			},
		];

		const skills: CommandItem[] = skillsRef.current.map((skill) => ({
			name: skill.name,
			value: `skill:${skill.path}`,
		}));

		return [
			{
				name: "Commands",
				items: [
					{ name: "model", value: "model", choices: models },
					...modelArgs,
					{
						name: "set-preset",
						value: "set-preset",
						dynamic: true,
						run: (value) => {
							if (!value) return;
							setPresetRef.current.mutate({
								name: value,
								config: configRef.current,
							});
						},
					},
					{
						name: "unset-preset",
						value: "unset-preset",
						choices: presets,
					},
					{
						name: "preset",
						value: "preset",
						choices: presets,
					},
					{ name: "system-prompt", value: "system-prompt", dynamic: true },
				],
			},
			{
				name: "Skills",
				items: skills,
			},
		];
	}, [setModelArgRef, setConfigRef]);

	return useMemo(
		() =>
			Command.configure({
				getCommands() {
					return getCommands();
				},
			} satisfies CommandOptions),
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
	const command =
		groups
			.flatMap((group) => group.items)
			.find((item) => item.name === commandNode?.attrs.name) ?? null;
	return { command, commandNode };
}

export function hasPendingCommandNode(editor: Editor) {
	const nodes = getCommandNodes(editor);
	return nodes.some(({ node }) => node.attrs["needs-run"] === "true");
}
