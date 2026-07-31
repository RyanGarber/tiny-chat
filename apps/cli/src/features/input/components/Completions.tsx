import { Box, Text, useInput, useWindowSize } from "ink";
import { ScrollList } from "ink-scroll-list";
import { useEffect, useState } from "react";

export interface CompletionItem {
	name: string;
	value: string;
}

export default function Completions<T extends CompletionItem>({
	items,
	onSelect,
}: {
	items: T[];
	onSelect: (item: T) => void;
}) {
	const { rows } = useWindowSize();
	const [selected, setSelected] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: item change should reset selection
	useEffect(() => {
		setSelected(0);
	}, [items, setSelected]);

	useInput((_, key) => {
		if (key.upArrow) {
			setSelected((previous) => Math.max(previous - 1, 0));
		}
		if (key.downArrow) {
			setSelected((previous) => Math.min(previous + 1, items.length - 1));
		}
		if (key.return) {
			onSelect(items[selected]);
		}
	});

	return (
		<ScrollList
			selectedIndex={selected}
			height={7}
			borderColor="blueBright"
			borderStyle="round"
		>
			{items.map((item, index) => (
				<Box key={item.value}>
					<Text color={selected === index ? "blue" : "white"}>
						{selected === index ? "▶ " : "  "}
						{item.name}
					</Text>
				</Box>
			))}
		</ScrollList>
	);
}
