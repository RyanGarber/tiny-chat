import {
	ActionIcon,
	Button,
	Group,
	Indicator,
	Modal,
	NavLink,
	ScrollArea,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import {
	CaretRightIcon,
	DotsThreeIcon,
	PlusCircleIcon,
} from "@phosphor-icons/react";
import { useChatList } from "@tiny-chat/client/src/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { useMessagingStore } from "@tiny-chat/client/src/features/chat/stores/useMessagingStore.ts";
import type {
	ChatState,
	FolderState,
} from "@tiny-chat/core/src/features/data/types/chat.ts";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useState,
} from "react";
import { client } from "#app/client.ts";
import { useSentinel } from "#app/core/hooks/useSentinel.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import Sentinel from "../../../core/components/Sentinel.tsx";

function Folder({
	_folders,
	chat,
	folder,
	setEditing,
}: {
	_folders: ReturnType<typeof useChatList>["folders"];
	chat?: ChatState | null;
	folder: FolderState;
	setEditing: Dispatch<SetStateAction<FolderState | ChatState | null>>;
}) {
	const isMobile = useAppStore((state) => state.isMobile);
	const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
	const activeFolder = useMessagingStore((state) => state.activeFolder);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const [isExpanded, setExpanded] = useState(false);

	const active = !chat && activeFolder?.id === folder.id;

	return (
		<NavLink
			key={folder.id}
			label={folder.title || "Untitled"}
			h={40}
			opened={isExpanded}
			onChange={setExpanded}
			className={`right-section-hover${active || isMobile ? " hover" : ""}`}
			leftSection={
				<CaretRightIcon
					color="var(--mantine-color-dimmed)"
					style={{
						transform: `rotate(${isExpanded ? 90 : 0}deg)`,
						transition: "transform 200ms ease",
					}}
				/>
			}
			rightSection={
				<Group gap={10}>
					<ActionIcon
						size={24}
						radius="xl"
						variant="light"
						onClick={(e) => {
							e.stopPropagation();
							setEditing(folder);
							setCurrentModal("edit-folder");
						}}
					>
						<DotsThreeIcon size={20} />
					</ActionIcon>
					<ActionIcon
						c={active ? undefined : "dimmed"}
						variant={active ? "filled" : "subtle"}
						className="nav-link-like filled"
						onClick={(event) => {
							event.stopPropagation();
							ChatService.newChat(folder);
							if (isMobile) setSidebarOpen(false);
						}}
						data-active={active}
					>
						<PlusCircleIcon />
					</ActionIcon>
				</Group>
			}
			disableRightSectionRotation
			defaultOpened
		>
			{_folders.data && (
				<Chat chat={_folders.data.pages?.[0]?.chats[1]} setEditing={() => {}} />
			)}
			{/* TODO - override open when in one of its chat */}
			{folder.chats.map((chat) => (
				<Chat key={chat.id} chat={chat} setEditing={setEditing} />
			))}
		</NavLink>
	);
}

function Chat({
	chat,
	setEditing,
}: {
	chat: ChatState;
	setEditing: Dispatch<SetStateAction<FolderState | ChatState | null>>;
}) {
	const active = useChatStore((state) => state.chatId === chat.id);
	const isMobile = useAppStore((state) => state.isMobile);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);
	const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);

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
				className={`right-section-hover${active || isMobile ? " hover" : ""}`}
				onClick={() => {
					ChatService.setChat(chat);
					if (isMobile) setSidebarOpen(false);
				}}
				h={40}
				{...(chat.unseen && { pl: 35 })}
				rightSection={
					<ActionIcon
						size={24}
						radius="xl"
						variant={active ? "white" : "light"}
						onClick={(e) => {
							e.stopPropagation();
							setEditing(chat);
							setCurrentModal("edit-chat");
						}}
					>
						<DotsThreeIcon size={20} />
					</ActionIcon>
				}
			/>
		</Indicator>
	);
}

export default function SidebarChatList({ chat }: { chat?: ChatState | null }) {
	const { folders, renameChat, deleteChat, createFolder } = useChatList();

	const currentModal = useAppStore((state) => state.currentModal);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const [editing, setEditing] = useState<FolderState | ChatState | null>(null);
	const [title, setTitle] = useState("");
	const saveTitle = useCallback(() => {
		editing &&
			renameChat.mutate(
				{ chat: editing as ChatState, title },
				{ onSuccess: () => setCurrentModal(null) },
			);
	}, [editing, title, renameChat, setCurrentModal]);

	const { viewportRef, sentinelRef } = useSentinel({
		query: folders,
		queryKey: client.query.chat.getChatList.pathKey(),
	});
	console.log(folders);
	return (
		<>
			<ScrollArea flex={1} viewportRef={viewportRef}>
				<Stack gap={10}>
					<Group justify="space-between" px="sm">
						<Text size="sm" c="dimmed">
							Folders
						</Text>
						<ActionIcon
							c="dimmed"
							variant="subtle"
							className="nav-link-like"
							loading={createFolder.isPending}
							disabled={createFolder.isPending}
							onClick={() => createFolder.mutate()}
						>
							+
						</ActionIcon>
					</Group>
					{folders.data?.pages
						.flatMap((page) => page.folders)
						.map((folder) => (
							<Folder
								key={folder.id}
								chat={chat}
								_folders={folders}
								folder={folder}
								setEditing={setEditing}
							/>
						))}
					<Text size="sm" c="dimmed" px="sm">
						Recents
					</Text>
					{folders.data?.pages
						.flatMap((page) => page.chats)
						.map((chat) => (
							<Chat key={chat.id} chat={chat} setEditing={setEditing} />
						))}
				</Stack>
				<Sentinel isFetching={folders.isFetching} ref={sentinelRef} />
			</ScrollArea>

			<Modal
				title="Edit Chat"
				opened={currentModal === "edit-chat"}
				onClose={() => setCurrentModal(null)}
				styles={{ content: StyleUtils.glass }}
				centered
			>
				<Stack>
					<TextInput
						placeholder="Chat Title"
						mb={10}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && saveTitle()}
						data-autofocus
					/>
					<Button
						variant="filled"
						fullWidth
						onClick={saveTitle}
						loading={renameChat.isPending}
						disabled={renameChat.isPending || !title}
					>
						Save
					</Button>
					<Button
						color="red"
						variant="outline"
						fullWidth
						onClick={() =>
							editing &&
							deleteChat.mutate(
								{ chat: editing as ChatState },
								{ onSuccess: () => setCurrentModal(null) },
							)
						}
						loading={deleteChat.isPending}
						disabled={deleteChat.isPending}
					>
						Delete
					</Button>
				</Stack>
			</Modal>
		</>
	);
}
