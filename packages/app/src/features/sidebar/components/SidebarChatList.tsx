import {
	Button,
	Modal,
	NavLink,
	ScrollArea,
	Stack,
	TextInput,
} from "@mantine/core";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { useChatList } from "@tiny-chat/client/src/features/chat/hooks/useChatList.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import type { ChatState } from "@tiny-chat/core/src/features/data/types/chat.ts";
import { useCallback, useState } from "react";
import { client } from "#app/client.ts";
import { useSentinel } from "#app/core/hooks/useSentinel.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import SidebarChatEntry from "#app/features/sidebar/components/SidebarChatEntry.tsx";
import Sentinel from "../../../core/components/Sentinel.tsx";

export default function SidebarChatList() {
	const { folders, renameChat, deleteChat } = useChatList();
	const { chat: currentChat } = useChat();

	const isMobile = useAppStore((state) => state.isMobile);
	const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
	const currentModal = useAppStore((state) => state.currentModal);
	const setCurrentModal = useAppStore((state) => state.setCurrentModal);

	const [title, setTitle] = useState<string>("");
	const [selectedChat, setSelectedChat] = useState<ChatState | null>(null);

	const close = useCallback(
		(action?: () => void) => {
			action?.();
			if (isMobile) setSidebarOpen(false);
		},
		[isMobile, setSidebarOpen],
	);

	const { viewportRef, sentinelRef } = useSentinel({
		query: folders,
		queryKey: client.query.chat.getChatList.pathKey(),
	});

	return (
		<>
			<ScrollArea flex={1} viewportRef={viewportRef}>
				<Stack gap={10}>
					{folders.data?.pages
						.flatMap((page) => page.folders)
						.map((folder) => {
							const chats = folder.chats.map((chat) => (
								<SidebarChatEntry
									key={chat.id}
									chat={chat}
									active={currentChat.data?.id === chat.id}
									onClick={() => close(() => ChatService.setChat(chat))}
									onRename={() => {
										setSelectedChat(chat);
										setTitle(chat.title ?? "");
										setCurrentModal("rename-chat");
									}}
									onDelete={() => {
										setSelectedChat(chat);
										setCurrentModal("delete-chat");
									}}
								/>
							));

							if (chats.length === 1) {
								return chats[0];
							} else {
								return (
									<NavLink
										key={folder.id}
										label={folder.title}
										leftSection={folder.chats.length}
										defaultOpened={true}
									>
										{chats}
									</NavLink>
								);
							}
						})}
				</Stack>
				<Sentinel isFetching={folders.isFetching} ref={sentinelRef} />
			</ScrollArea>

			<Modal
				title="Rename Chat"
				opened={currentModal === "rename-chat"}
				onClose={() => setCurrentModal(null)}
				styles={{ content: StyleUtils.glass }}
				centered
			>
				<TextInput
					placeholder="Chat Title"
					mb={10}
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					onKeyDown={(e) =>
						e.key === "Enter" &&
						selectedChat &&
						renameChat.mutate(
							{ chat: selectedChat, title },
							{ onSuccess: () => setCurrentModal(null) },
						)
					}
					data-autofocus
				/>
				<Button
					variant="filled"
					fullWidth
					onClick={() =>
						selectedChat &&
						renameChat.mutate(
							{ chat: selectedChat, title },
							{ onSuccess: () => setCurrentModal(null) },
						)
					}
					loading={renameChat.isPending}
					disabled={renameChat.isPending || !title}
				>
					Save
				</Button>
			</Modal>

			<Modal
				title="Delete Chat"
				opened={currentModal === "delete-chat"}
				onClose={() => setCurrentModal(null)}
				styles={{ content: StyleUtils.glass }}
				centered
			>
				<Button
					color="red"
					fullWidth
					onClick={() =>
						selectedChat &&
						deleteChat.mutate(
							{ chat: selectedChat },
							{ onSuccess: () => setCurrentModal(null) },
						)
					}
					loading={deleteChat.isPending}
					disabled={deleteChat.isPending}
				>
					Confirm
				</Button>
			</Modal>
		</>
	);
}
