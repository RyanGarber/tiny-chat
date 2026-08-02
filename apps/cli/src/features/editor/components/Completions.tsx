import type { CompletionGroup } from "@tiny-chat/client/src/features/editor/types/command.ts";
import { Box, Text } from "ink";
import { ScrollList } from "ink-scroll-list";

export default function Completions({
	groups,
	selected,
}: {
	groups: CompletionGroup[];
	selected: number;
}) {
	const items = groups.flatMap((group) =>
		group.items.map((item, position) => ({
			...item,
			group: position === 0 ? group.name : undefined,
		})),
	);

	return (
		<ScrollList
			selectedIndex={selected}
			height={7}
			borderColor="blueBright"
			borderStyle="round"
		>
			{items.map((item, index) => (
				<Box key={item.value} flexDirection="column">
					{item.group && <Text color="gray">--- {item.group} ---</Text>}
					<Text
						color={
							index === selected ? "blue" : item.active ? "green" : "white"
						}
					>
						{index === selected ? "▶ " : "  "}
						{item.name ?? item.value}
					</Text>
				</Box>
			))}
		</ScrollList>
	);
}
