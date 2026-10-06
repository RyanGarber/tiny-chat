import { type Key, useInput, useWindowSize } from "ink";
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useState,
} from "react";
import { useCompletionStore } from "#client/features/editor/stores/useCompletionStore.ts";
import type {
	CompletionGroup,
	CompletionItem,
} from "#client/features/editor/types/completion.ts";
import Box, { type BoxProps } from "#tui/core/components/Box.tsx";
import HelpText, { type Action } from "#tui/core/components/HelpText.tsx";
import { usePanel } from "#tui/core/components/Panel.tsx";
import ScrollView, {
	type ScrollViewProps,
} from "#tui/core/components/ScrollView.tsx";
import Text from "#tui/core/components/Text.tsx";
import { useMouseInput } from "#tui/core/hooks/useMouseInput.ts";

export type CompletionsProps<
	T1 extends CompletionGroup<T2>,
	T2 extends CompletionItem,
> = ScrollViewProps & {
	groups: T1[];
	selected?: number;
	setSelected?: (_: (previous?: number) => number) => void;
	itemRef?: RefObject<T2 | null>;
	/** Takes the keys, and draws its selection as such. Defaults to whether its panel is focused. */
	active?: boolean;
	onInput?: (_: {
		item?: T2;
		input: string;
		key: Key;
		/** The key was stood in for by a press on the item, not typed. */
		pointer?: boolean;
	}) => boolean | undefined;
	itemProps?: BoxProps;
	renderItem?: (_: { item: T2; selected: boolean }) => ReactNode;
	renderEmpty?: () => ReactNode;
	withStyles?: boolean;
	before?: ReactNode;
	after?: ReactNode;
	actions?: Action[];
	/** Draws the keys it takes below it. */
	help?: boolean;
	selectFirstOnChange?: boolean;
	stickToBottom?: number;
	/** Takes the full height it is given, as a sidebar does, instead of half the screen at most. */
	fill?: boolean;
};

export default function Completions<
	T1 extends CompletionGroup<T2>,
	T2 extends CompletionItem = CompletionItem,
>({
	groups,
	selected: controlledSelected,
	setSelected: setControlledSelected,
	itemRef,
	onInput,
	active: _active,
	itemProps,
	renderItem,
	renderEmpty,
	before,
	after,
	actions,
	help = true,
	selectFirstOnChange = true,
	stickToBottom,
	fill = false,
	...props
}: CompletionsProps<T1, T2>) {
	const { rows } = useWindowSize();
	const panel = usePanel();
	const active = _active ?? panel.focused;

	const items = groups.flatMap((group) =>
		group.items.map((item, position) => ({
			...item,
			group: group.name,
			groupLabel: position === 0 ? group.name : undefined,
		})),
	);

	const [uncontrolledSelected, setUncontrolledSelected] = useState(0);

	const selected = controlledSelected ?? uncontrolledSelected;
	const setSelected = setControlledSelected ?? setUncontrolledSelected;

	const setIsCompletionsOpen = useCompletionStore(
		(state) => state.setIsCompletionsOpen,
	);
	const setIsCompletionsEmpty = useCompletionStore(
		(state) => state.setIsCompletionsEmpty,
	);

	useEffect(() => {
		if (!active) return;
		setIsCompletionsOpen(true);
		setIsCompletionsEmpty(!items.length);
		return () => {
			setIsCompletionsOpen(false);
			setIsCompletionsEmpty(true);
		};
	}, [setIsCompletionsOpen, setIsCompletionsEmpty, items.length, active]);

	const pick = useCallback(
		(offset: number) => {
			if (!items.length) return;
			setSelected(
				(previous) => ((previous ?? 0) + offset + items.length) % items.length,
			);
		},
		[items.length, setSelected],
	);

	useInput(
		(input, key) => {
			if (onInput?.({ item: items[selected], input, key }) === false) {
				return;
			}
			if (key.upArrow) {
				pick(-1);
			}
			if (key.downArrow) {
				pick(1);
			}
		},
		{ isActive: active },
	);

	const [hovered, setHovered] = useState<number | null>(null);
	const { mouseRef } = useMouseInput({
		onClick: ({ index }) => {
			if (index === undefined) return;
			// Only a press on what is already selected, in a list that already has
			// the focus, goes through: the first press on a list elsewhere just
			// focuses it (through its panel) and selects.
			if (active && selected === index) {
				onInput?.({
					item: items[selected],
					input: "",
					key: { return: true } as Key,
					pointer: true,
				});
			} else {
				setSelected(() => index);
			}
		},
		onHoverStart: ({ index }) => {
			setHovered(index);
		},
		onHoverEnd: ({ index }) => {
			if (hovered === index) setHovered(null);
		},
		isActive: !!items.length,
	});

	useEffect(() => {
		if (selectFirstOnChange && items.length) {
			setSelected(() => 0);
		}
	}, [setSelected, selectFirstOnChange, items.length]);

	useEffect(() => {
		if (!itemRef) return;
		itemRef.current = items[selected] ?? null;
	}, [selected, itemRef, items]);

	return (
		<Box
			padding={1}
			flexDirection="column"
			flexShrink={fill ? 1 : 0}
			flexGrow={fill ? 1 : 0}
			minHeight={fill ? 0 : undefined}
			backgroundColor="interior"
		>
			{before}
			<ScrollView
				selectedIndex={selected}
				{...(fill
					? { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0 }
					: { maxHeight: Math.floor(rows / 2) })}
				paddingBottom={1}
				{...props}
			>
				{items.map((item, index) => {
					const rendered =
						renderItem?.({ item, selected: index === selected }) ?? item.name;
					const groupIndex = groups.findIndex(
						(group) => group.name === item.group,
					);
					return (
						<Box key={item.group + item.value} flexDirection="column">
							{item.groupLabel && (
								<Box marginLeft={2} marginTop={groupIndex > 0 ? 1 : 0}>
									<Text color="textSubtle" bold>
										{item.groupLabel.toLowerCase()}
									</Text>
								</Box>
							)}
							<Box
								ref={(element) => mouseRef(element, index)}
								color={
									index === selected
										? active
											? "primary"
											: "textSubtle"
										: undefined
								}
								dimColor={index === hovered || item.active}
							>
								<Text>{index === selected ? "▶ " : "  "}</Text>
								<Box gap={1} {...itemProps}>
									{typeof rendered === "string" ? (
										<Text>{rendered}</Text>
									) : (
										rendered
									)}
								</Box>
							</Box>
						</Box>
					);
				})}
				{items.length === 0 && renderEmpty && (
					<Text color="textSubtle">{renderEmpty()}</Text>
				)}
			</ScrollView>
			{after}
			{help && <HelpText actions={["choose", ...(actions ?? [])]} />}
		</Box>
	);
}
