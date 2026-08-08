import { Icon } from "@iconify/react";
import { ActionIcon, Indicator, Menu, NavLink } from "@mantine/core";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import { useState } from "react";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";

export default function SidebarChatEntry({
	chat,
	active,
	onClick,
	onRename,
	onDelete,
}: {
	chat: ChatState;
	active: boolean;
	onClick: () => void;
	onRename: () => void;
	onDelete: () => void;
}) {
	const isMobile = useAppStore((s) => s.isMobile);
	const [isOpen, setOpen] = useState(false);

	return (
		<Indicator
			size={8}
			disabled={!chat.unseen}
			color={active ? "white" : "blue"}
			position="middle-start"
			offset={20}
		>
			<NavLink
				key={chat.id}
				label={chat.title ?? "Sending..."}
				variant="filled"
				active={active}
				className={`section-on-hover${active || isMobile || isOpen ? " hover" : ""}`}
				onClick={onClick}
				h={40}
				{...(chat.unseen && { pl: 35 })}
				rightSection={
					<Menu
						width={200}
						onChange={setOpen}
						styles={{ dropdown: { boxShadow: StyleUtils.shadow } }}
					>
						<Menu.Target>
							<ActionIcon
								size={24}
								radius="xl"
								variant={active ? "white" : isOpen ? "filled" : "light"}
								onClick={(e) => e.stopPropagation()}
							>
								<Icon icon="lucide:ellipsis" height={16} />
							</ActionIcon>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Item
								leftSection={<Icon icon="lucide:folder-pen" height={18} />}
								onClick={(e) => {
									e.stopPropagation();
									onRename();
								}}
							>
								Rename
							</Menu.Item>
							<Menu.Item
								leftSection={<Icon icon="lucide:trash" height={18} />}
								onClick={(e) => {
									e.stopPropagation();
									onDelete();
								}}
							>
								Delete
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				}
			/>
		</Indicator>
	);
}
