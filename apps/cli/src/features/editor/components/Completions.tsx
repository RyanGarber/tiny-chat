import { useCompletionStore } from "@tiny-chat/client/src/features/editor/stores/useCompletionStore.ts";
import type {
	CompletionGroup,
	CompletionItem,
} from "@tiny-chat/client/src/features/editor/types/completion.ts";
import { type Key, useInput, useWindowSize } from "ink";
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useState,
} from "react";
import Box, { type BoxProps } from "../../../core/components/Box.tsx";
import HelpText, { type Action } from "../../../core/components/HelpText.tsx";
import ScrollView, {
	type ScrollViewProps,
} from "../../../core/components/ScrollView.tsx";
import Text from "../../../core/components/Text.tsx";
import { useMouseInput } from "../../../core/hooks/useMouseInput.ts";

export type CompletionsProps<
	T1 extends CompletionGroup<T2>,
	T2 extends CompletionItem,
> = ScrollViewProps & {
	groups: T1[];
	selected?: number;
	setSelected?: (_: (previous?: number) => number) => void;
	itemRef?: RefObject<T2 | null>;
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
	selectFirstOnChange?: boolean;
	stickToBottom?: number;
};

export default function Completions<
	T1 extends CompletionGroup<T2>,
	T2 extends CompletionItem,
>({
	groups,
	selected: controlledSelected,
	setSelected: setControlledSelected,
	itemRef,
	onInput,
	itemProps,
	renderItem,
	renderEmpty,
	before,
	after,
	actions,
	selectFirstOnChange = true,
	stickToBottom,
	...props
}: CompletionsProps<T1, T2>) {
	const { rows } = useWindowSize();

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
		setIsCompletionsOpen(true);
		setIsCompletionsEmpty(!items.length);
		return () => {
			setIsCompletionsOpen(false);
			setIsCompletionsEmpty(true);
		};
	}, [setIsCompletionsOpen, setIsCompletionsEmpty, items.length]);

	const pick = useCallback(
		(offset: number) => {
			setSelected((previous) =>
				Math.min(Math.max((previous ?? 0) + offset, 0), items.length - 1),
			);
		},
		[items.length, setSelected],
	);

	useInput((input, key) => {
		if (onInput?.({ item: items[selected], input, key }) === false) {
			return;
		}
		if (key.upArrow) {
			pick(-1);
		}
		if (key.downArrow) {
			pick(1);
		}
	});

	const [hovered, setHovered] = useState<number | null>(null);
	const { mouseRef } = useMouseInput({
		onClick: ({ index }) => {
			if (index === undefined) return;
			if (selected === index) {
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
			flexShrink={0}
			backgroundColor="interior"
		>
			{before}
			<ScrollView
				selectedIndex={selected}
				maxHeight={Math.floor(rows / 2)}
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
								color={index === selected ? "primary" : undefined}
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
			<HelpText actions={["choose", "select", ...(actions ?? [])]} />
		</Box>
	);
}
