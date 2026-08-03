import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { useCompletionStore } from "@tiny-chat/client/src/features/editor/stores/useCompletionStore.ts";
import type {
	CompletionGroup,
	CompletionItem,
} from "@tiny-chat/client/src/features/editor/types/completion.ts";
import { Box, type Key, Text, useInput, useWindowSize } from "ink";
import {
	ScrollList,
	type ScrollListProps,
	type ScrollListRef,
} from "ink-scroll-list";
import {
	type ReactNode,
	type RefAttributes,
	useCallback,
	useEffect,
	useState,
} from "react";
import HelpText, { type Action } from "../../../core/components/HelpText.tsx";

export type CompletionsProps<
	T1 extends CompletionGroup<T2>,
	T2 extends CompletionItem,
> = ScrollListProps &
	RefAttributes<ScrollListRef> & {
		groups: T1[];
		selected?: number;
		setSelected?: (_: (previous: number) => number) => void;
		onInput?: (_: {
			item?: T2;
			input: string;
			key: Key;
		}) => boolean | undefined;
		renderItem?: (_: {
			item: T2;
			selected: boolean;
			color: string;
		}) => ReactNode;
		renderEmpty?: () => ReactNode;
		withStyles?: boolean;
		before?: ReactNode;
		after?: ReactNode;
		actions?: Action[];
		selectFirstOnChange?: boolean;
	};

export default function Completions<
	T1 extends CompletionGroup<T2>,
	T2 extends CompletionItem,
>({
	groups,
	selected: controlledSelected,
	setSelected: setControlledSelected,
	onInput,
	renderItem,
	renderEmpty,
	before,
	after,
	actions,
	selectFirstOnChange = true,
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
		setIsCompletionsEmpty(groups.length === 0);
		return () => {
			setIsCompletionsOpen(false);
			setIsCompletionsEmpty(true);
		};
	}, [setIsCompletionsOpen, setIsCompletionsEmpty, groups.length]);

	const pick = useCallback(
		(offset: number) => {
			setSelected((previous) =>
				Math.min(Math.max(previous + offset, 0), items.length - 1),
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

	useEffect(() => {
		if (selectFirstOnChange && items.length) {
			setSelected(() => 0);
		}
	}, [setSelected, selectFirstOnChange, items.length]);

	const chatId = useChatStore((state) => state.chatId);

	return (
		<Box
			borderStyle="round"
			borderColor="blueBright"
			paddingX={1}
			marginBottom={chatId ? 1 : 0}
			flexDirection="column"
		>
			{before}
			<ScrollList
				selectedIndex={selected}
				minHeight={7}
				maxHeight={rows - 7}
				scrollAlignment="top"
				{...props}
			>
				{items.map((item, index) => {
					const color =
						index === selected ? "blueBright" : item.active ? "gray" : "white";
					const rendered =
						renderItem?.({ item, selected: index === selected, color }) ??
						item.name;
					return (
						<Box key={item.group + item.value} flexDirection="column">
							{item.groupLabel && (
								<Box marginLeft={2}>
									<Text color="gray">--- {item.groupLabel} ---</Text>
								</Box>
							)}
							<Box>
								<Text color={color}>{index === selected ? "▶ " : "  "}</Text>
								<Box>
									{typeof rendered === "string" ? (
										<Text color={color}>{rendered}</Text>
									) : (
										rendered
									)}
								</Box>
							</Box>
						</Box>
					);
				})}
				{items.length === 0 && renderEmpty && (
					<Text dimColor>{renderEmpty()}</Text>
				)}
			</ScrollList>
			{after}
			<HelpText actions={["choose", ...(actions ?? []), "select"]} />
		</Box>
	);
}
