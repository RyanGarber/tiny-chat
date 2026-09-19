import {
	ActionIcon,
	Button,
	Group,
	Indicator,
	Modal,
	NavLink,
	Overlay,
	ScrollArea,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import {
	CaretRightIcon,
	DotsThreeIcon,
	PlusCircleIcon,
	TrashIcon,
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
	type DragEvent,
	type SetStateAction,
	useState,
} from "react";
import { client } from "#app/client.ts";
import { useSentinel } from "#app/core/hooks/useSentinel.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import scrollable from "#app/core/styles/scrollable.module.css";
import ContextSettings from "#app/features/sidebar/components/ContextSettings.tsx";
import Sentinel from "../../../core/components/Sentinel.tsx";

type ChatDragHandlers = {
	onDragEnd: () => void;
	onDragStart: (event: DragEvent<HTMLElement>, chat: ChatState) => void;
};

function ChatDropOverlay({ label, color }: { label: string; color: string }) {
	return (
		<Overlay
			color={`var(--mantine-color-${color}-filled)`}
			backgroundOpacity={0.2}
			blur={1}
			radius="md"
			center
			zIndex={5}
			style={{
				border: `1px dashed var(--mantine-color-${color}-5)`,
				pointerEvents: "none",
			}}
		>
			<Text
				fw={600}
				size="sm"
				px="sm"
				py={6}
				style={{
					background: "var(--mantine-color-body)",
					borderRadius: "var(--mantine-radius-md)",
					boxShadow: "var(--mantine-shadow-md)",
				}}
			>
				{label}
			</Text>
		</Overlay>
	);
}

function Folder({
	chat,
	folder,
	setEditing,
	dragHandlers,
	dropActive,
	onDragEnter,
	onDragLeave,
	onDragOver,
	onDrop,
}: {
	chat?: ChatState | null;
	folder: FolderState;
	setEditing: Dispatch<SetStateAction<FolderState | ChatState | null>>;
	dragHandlers: ChatDragHandlers;
	dropActive: boolean;
	onDragEnter: (event: DragEvent<HTMLElement>) => void;
	onDragLeave: (event: DragEvent<HTMLElement>) => void;
	onDragOver: (event: DragEvent<HTMLElement>) => void;
	onDrop: (event: DragEvent<HTMLElement>) => void;
}) {
	const isMobile = useAppStore((state) => state.isMobile);
	const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
	const activeFolder = useMessagingStore((state) => state.activeFolder);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const [isExpanded, setExpanded] = useState(false);

	const active = !chat && activeFolder?.id === folder.id;

	return (
		<Stack
			gap={0}
			pos="relative"
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
			onDragOver={onDragOver}
			onDrop={onDrop}
		>
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
				{folder.chats.map((chat) => (
					<Chat
						key={chat.id}
						chat={chat}
						setEditing={setEditing}
						dragHandlers={dragHandlers}
					/>
				))}
			</NavLink>
			{dropActive ? (
				<ChatDropOverlay
					label={`Move to ${folder.title || "Untitled"}`}
					color="blue"
				/>
			) : null}
		</Stack>
	);
}

function FolderEditor({ editing }: { editing: FolderState }) {
	const { renameFolder, deleteFolder } = useChatList();

	const currentModal = useAppStore((state) => state.currentModal);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const [title, setTitle] = useState(editing.title ?? "");
	const [cwd, setCwd] = useState(editing.cwd ?? "");
	const [cwdError, setCwdError] = useState<string | null>(null);
	const [validating, setValidating] = useState(false);
	const save = async () => {
		setValidating(true);
		setCwdError(null);
		try {
			if (client.desktop && cwd) {
				if (cwd === "/mnt" || cwd.startsWith("/mnt/")) {
					const [, , mount, id] = cwd.split("/");
					await client.api.file.getDirectory.query({
						path: cwd,
						chat: mount === "chat" ? id : undefined,
						uploads: mount === "uploads" && id ? [id] : [],
						skills: mount === "skills" && id ? [id] : [],
					});
				} else await client.shell?.readDir({ path: cwd });
			}
		} catch {
			setCwdError("Cannot open this directory");
			setValidating(false);
			return;
		}
		setValidating(false);
		renameFolder.mutate(
			{ folder: editing, title, cwd: cwd || null },
			{ onSuccess: () => setCurrentModal(null) },
		);
	};

	return (
		<Modal
			title="Edit Folder"
			opened={currentModal === "edit-folder"}
			onClose={() => setCurrentModal(null)}
			centered
			classNames={scrollable}
		>
			<ScrollArea.Autosize offsetScrollbars>
				<Stack>
					<TextInput
						label="Title"
						value={title}
						disabled={renameFolder.isPending}
						onChange={(e) => setTitle(e.target.value)}
						data-autofocus
					/>
					<TextInput
						label="Working directory"
						value={cwd}
						error={cwdError}
						disabled={!client.desktop || renameFolder.isPending || validating}
						onChange={(event) => {
							setCwd(event.target.value);
							setCwdError(null);
						}}
					/>
					<ContextSettings folder={editing.id} />
					<Button.Group mt="lg">
						<Button
							variant="default"
							fullWidth
							onClick={save}
							loading={renameFolder.isPending}
							disabled={renameFolder.isPending || validating || !title}
						>
							Save
						</Button>
						<Button
							variant="outline"
							color="red"
							onClick={() =>
								deleteFolder.mutate(
									{ folder: editing, deleteChats: true },
									{ onSuccess: () => setCurrentModal(null) },
								)
							}
							loading={deleteFolder.isPending}
							disabled={deleteFolder.isPending}
						>
							<TrashIcon size={20} />
						</Button>
					</Button.Group>
				</Stack>
			</ScrollArea.Autosize>
		</Modal>
	);
}

function Chat({
	chat,
	setEditing,
	dragHandlers,
}: {
	chat: ChatState;
	setEditing: Dispatch<SetStateAction<FolderState | ChatState | null>>;
	dragHandlers: ChatDragHandlers;
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
				draggable
				onDragStart={(event) => dragHandlers.onDragStart(event, chat)}
				onDragEnd={dragHandlers.onDragEnd}
				style={{ cursor: "grab" }}
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

function ChatEditor({ editing }: { editing: ChatState }) {
	const { renameChat, deleteChat } = useChatList();

	const currentModal = useAppStore((state) => state.currentModal);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const [title, setTitle] = useState(editing.title ?? "");

	return (
		<Modal
			title="Edit Chat"
			opened={currentModal === "edit-chat"}
			onClose={() => setCurrentModal(null)}
			centered
		>
			<Stack>
				<TextInput
					placeholder="Chat Title"
					mb={10}
					value={title}
					disabled={renameChat.isPending}
					onChange={(e) => setTitle(e.target.value)}
					data-autofocus
				/>
				<Button.Group>
					<Button
						variant="default"
						fullWidth
						onClick={() =>
							editing &&
							renameChat.mutate(
								{ chat: editing, title },
								{ onSuccess: () => setCurrentModal(null) },
							)
						}
						loading={renameChat.isPending}
						disabled={renameChat.isPending || !title}
					>
						Save
					</Button>
					<Button
						variant="outline"
						color="red"
						onClick={() =>
							deleteChat.mutate(
								{ chat: editing },
								{ onSuccess: () => setCurrentModal(null) },
							)
						}
						loading={deleteChat.isPending}
						disabled={deleteChat.isPending}
					>
						<TrashIcon size={20} />
					</Button>
				</Button.Group>
			</Stack>
		</Modal>
	);
}

export default function SidebarContent({ chat }: { chat?: ChatState | null }) {
	const { folders, createFolder, moveChat } = useChatList();

	const currentModal = useAppStore((state) => state.currentModal);

	const [editing, setEditing] = useState<FolderState | ChatState | null>(null);
	const [draggedChat, setDraggedChat] = useState<ChatState | null>(null);
	const [dropFolderId, setDropFolderId] = useState<string | null | undefined>(
		undefined,
	);

	const dragHandlers: ChatDragHandlers = {
		onDragStart: (event, dragged) => {
			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData("text/plain", dragged.id);
			setDraggedChat(dragged);
		},
		onDragEnd: () => {
			setDraggedChat(null);
			setDropFolderId(undefined);
		},
	};

	const isValidDrop = (folderId: string | null) =>
		draggedChat !== null && draggedChat.folderId !== folderId;
	const handleDragEnter = (
		event: DragEvent<HTMLElement>,
		folderId: string | null,
	) => {
		if (!isValidDrop(folderId)) return;
		event.preventDefault();
		setDropFolderId(folderId);
	};
	const handleDragOver = (
		event: DragEvent<HTMLElement>,
		folderId: string | null,
	) => {
		if (!isValidDrop(folderId)) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
	};
	const handleDragLeave = (event: DragEvent<HTMLElement>) => {
		const nextTarget = event.relatedTarget;
		if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget))
			return;
		setDropFolderId(undefined);
	};
	const handleDrop = (
		event: DragEvent<HTMLElement>,
		folderId: string | null,
	) => {
		if (!isValidDrop(folderId) || !draggedChat) return;
		event.preventDefault();
		moveChat.mutate({ chat: draggedChat, folderId });
		setDraggedChat(null);
		setDropFolderId(undefined);
	};

	const { viewportRef, sentinelRef } = useSentinel({
		query: folders,
		queryKey: client.query.chat.getChatList.pathKey(),
	});

	return (
		<>
			<ScrollArea
				flex={1}
				viewportRef={viewportRef}
				styles={{
					content: {
						display: "flex",
						flexDirection: "column",
						minHeight: "100%",
					},
				}}
			>
				<Stack gap={10} flex={1}>
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
								folder={folder}
								setEditing={setEditing}
								dragHandlers={dragHandlers}
								dropActive={dropFolderId === folder.id}
								onDragEnter={(event) => handleDragEnter(event, folder.id)}
								onDragLeave={handleDragLeave}
								onDragOver={(event) => handleDragOver(event, folder.id)}
								onDrop={(event) => handleDrop(event, folder.id)}
							/>
						))}
					<Stack
						gap={10}
						flex={1}
						mih={120}
						pos="relative"
						onDragEnter={(event) => handleDragEnter(event, null)}
						onDragLeave={handleDragLeave}
						onDragOver={(event) => handleDragOver(event, null)}
						onDrop={(event) => handleDrop(event, null)}
					>
						<Text size="sm" c="dimmed" px="sm">
							Recents
						</Text>
						{folders.data?.pages
							.flatMap((page) => page.chats)
							.map((chat) => (
								<Chat
									key={chat.id}
									chat={chat}
									setEditing={setEditing}
									dragHandlers={dragHandlers}
								/>
							))}
						<Sentinel isFetching={folders.isFetching} ref={sentinelRef} />
						{dropFolderId === null ? (
							<ChatDropOverlay label="Move to Recents" color="grape" />
						) : null}
					</Stack>
				</Stack>
			</ScrollArea>
			{currentModal === "edit-chat" && (
				<ChatEditor editing={editing as ChatState} />
			)}
			{currentModal === "edit-folder" && (
				<FolderEditor editing={editing as FolderState} />
			)}
		</>
	);
}
