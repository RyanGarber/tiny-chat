import {
	Box,
	Combobox,
	Group,
	Paper,
	ScrollAreaAutosize,
	Text,
	useCombobox,
} from "@mantine/core";
import type {
	CompletionGroup,
	CompletionItem,
} from "@tiny-chat/client/src/features/editor/types/command.ts";
import { type Editor, type Range, ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import {
	forwardRef,
	type ReactNode,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
} from "react";
import { useCompletionsStore } from "#ui/features/editor/stores/useCompletionsStore.ts";

export type { CompletionGroup, CompletionItem };

export type SuggestionRenderer<T1, T2> = ReturnType<
	NonNullable<SuggestionOptions<T1, T2>["render"]>
>;

export interface CompletionProps<
	T1 extends CompletionGroup<T2>,
	T2 extends CompletionItem,
> extends SuggestionProps<T1, T2> {
	renderEmpty: () => ReactNode;
	renderItem?: (item: T2) => ReactNode;
	onTab?: (args: {
		item: T2;
		editor: Editor;
		range: Range;
		select: () => void;
	}) => boolean | undefined;
}

function Completions<
	T1 extends CompletionGroup<T2>,
	T2 extends CompletionItem,
>() {
	return forwardRef<SuggestionRenderer<T1, T2>, CompletionProps<T1, T2>>(
		(
			{
				items: _groups,
				command,
				editor,
				range,
				renderEmpty,
				renderItem,
				onTab,
			},
			ref,
		) => {
			const combobox = useCombobox();

			const [groups, items] = useMemo(
				() => [
					_groups.filter((group) => group.items.length),
					_groups.flatMap((group) => group.items),
				],
				[_groups],
			);

			const select = useCallback(
				(value: string) => {
					const item = items.find((item) => item.value === value);
					if (item) command(item);
				},
				[items, command],
			);

			useImperativeHandle(
				ref,
				() => ({
					onKeyDown: ({ event }) => {
						if (event.key === "ArrowDown") {
							combobox.selectNextOption();
							return true;
						}
						if (event.key === "ArrowUp") {
							combobox.selectPreviousOption();
							return true;
						}
						if (event.key === "Enter") {
							combobox.clickSelectedOption();
							return true;
						}
						if (event.key === "Tab") {
							const item = items[combobox.getSelectedOptionIndex()];
							if (!item) return true;

							if (onTab) {
								const handled = onTab({
									item,
									editor,
									range,
									select: () => select(item.value),
								});
								if (handled !== false) return true;
							}

							select(item.value);
							return true;
						}
						return false;
					},
				}),
				[combobox, editor, items, onTab, range, select],
			);

			// biome-ignore lint/correctness/useExhaustiveDependencies: auto select
			useEffect(() => {
				combobox.selectFirstOption();
			}, [groups, combobox.selectFirstOption]);

			const setIsCompletionsOpen = useCompletionsStore(
				(s) => s.setIsCompletionsOpen,
			);
			const setIsCompletionsEmpty = useCompletionsStore(
				(s) => s.setIsCompletionsEmpty,
			);
			useEffect(() => {
				setIsCompletionsOpen(true);
				setIsCompletionsEmpty(groups.length === 0);
				return () => {
					setIsCompletionsOpen(false);
					setIsCompletionsEmpty(true);
				};
			}, [setIsCompletionsOpen, setIsCompletionsEmpty, groups.length]);

			return (
				<Combobox store={combobox} onOptionSubmit={select} withinPortal={false}>
					<Paper withBorder>
						<Combobox.Options>
							<ScrollAreaAutosize mah={300} w={250} p={5}>
								<Box>
									{groups.length === 0 && (
										<Text size="sm" p="xs">
											{renderEmpty()}
										</Text>
									)}
									{groups.map((group) => (
										<Combobox.Group
											key={group.items.map((item) => item.value).join(",")}
											label={group.name}
										>
											{group.items.map((item) => (
												<Combobox.Option
													key={item.value}
													value={item.value}
													disabled={item.active}
												>
													<Group
														gap={5}
														miw={0}
														wrap="nowrap"
														align="flex-start"
														style={{
															overflow: "hidden",
															whiteSpace: "nowrap",
															textOverflow: "ellipsis",
														}}
													>
														{renderItem ? renderItem(item) : item.name}
													</Group>
												</Combobox.Option>
											))}
										</Combobox.Group>
									))}
								</Box>
							</ScrollAreaAutosize>
						</Combobox.Options>
					</Paper>
				</Combobox>
			);
		},
	);
}

export function renderCompletions<
	T1 extends CompletionGroup<T2>,
	T2 extends CompletionItem,
>(
	props: Omit<CompletionProps<T1, T2>, keyof SuggestionProps<T1, T2>>,
): () => SuggestionRenderer<T1, T2> {
	let instance: ReactRenderer<
		SuggestionRenderer<T1, T2>,
		CompletionProps<T1, T2>
	> | null = null;
	let unmount: (() => void) | null = null;

	return () => ({
		onStart: (baseProps) => {
			instance = new ReactRenderer<
				SuggestionRenderer<T1, T2>,
				CompletionProps<T1, T2>
			>(Completions<T1, T2>(), {
				props: {
					...baseProps,
					...props,
				},
				editor: baseProps.editor,
			});
			unmount = baseProps.mount(instance.element);
		},
		onUpdate: (props) => {
			instance?.updateProps(props);
		},
		onKeyDown: (props) => instance?.ref?.onKeyDown?.(props) ?? false,
		onExit: () => {
			unmount?.();
			instance?.destroy();
			instance = null;
			unmount = null;
		},
	});
}
