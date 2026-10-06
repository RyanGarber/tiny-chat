import { Button, Menu, ScrollArea, Switch, Text } from "@mantine/core";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";

export interface CapabilityMenuItem {
	key: string;
	name: string;
	checked: boolean;
	disabled?: boolean;
	onToggle: () => void;
}

/** A quick on/off list, with the full capabilities modal behind "More". */
export default function CapabilityMenu({
	label,
	items,
	disabled,
	onMore,
	className,
	zIndex,
}: {
	label: string;
	items: CapabilityMenuItem[];
	disabled?: boolean;
	/** Without it there is nothing more to open, as inside the modal itself. */
	onMore?: () => void;
	className?: string;
	zIndex?: number;
}) {
	return (
		<Menu
			position="top"
			closeOnItemClick={false}
			transitionProps={{ transition: "fade-up" }}
			classNames={{ dropdown: className }}
			zIndex={zIndex}
		>
			<Menu.Target>
				<Button
					flex={1}
					variant="transparent"
					c="dimmed"
					size="xs"
					disabled={disabled}
				>
					{label}
				</Button>
			</Menu.Target>
			<Menu.Dropdown miw={200} maw={300}>
				<ScrollArea.Autosize mah={300} type="auto">
					{items.map((item) => (
						<Menu.Item
							key={item.key}
							disabled={item.disabled}
							onClick={item.onToggle}
							rightSection={
								<Switch
									size="xs"
									checked={item.checked}
									disabled={item.disabled}
									readOnly
									tabIndex={-1}
									style={{ pointerEvents: "none" }}
								/>
							}
						>
							<Text size="sm" truncate>
								{item.name}
							</Text>
						</Menu.Item>
					))}
					{!items.length && (
						<Text size="xs" c="dimmed" p="xs">
							Nothing here yet
						</Text>
					)}
				</ScrollArea.Autosize>
				{onMore && (
					<>
						<Menu.Divider />
						<Menu.Item
							leftSection={<SlidersHorizontalIcon size={16} />}
							closeMenuOnClick
							onClick={onMore}
						>
							More
						</Menu.Item>
					</>
				)}
			</Menu.Dropdown>
		</Menu>
	);
}
