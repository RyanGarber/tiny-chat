import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Box,
	Group,
	ScrollArea,
	Stack,
	Text,
	Transition,
} from "@mantine/core";
import { useMergedRef } from "@mantine/hooks";
import { useIsMutating } from "@tanstack/react-query";
import { useGreeting } from "@tiny-chat/client/src/core/hooks/useGreeting.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { useMessages } from "@tiny-chat/client/src/features/chat/hooks/useMessages.ts";
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import {
	type RefObject,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { client } from "#app/client.ts";
import Sentinel from "#app/core/components/Sentinel.tsx";
import { useAutoScroll } from "#app/core/hooks/useAutoScroll.ts";
import { useSentinel } from "#app/core/hooks/useSentinel.ts";
import { useLayoutStore } from "#app/core/stores/useLayoutStore.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import Actions from "#app/features/chat/components/Actions.tsx";
import ChatHeader from "#app/features/chat/components/ChatHeader.tsx";
import { ChatInput } from "#app/features/chat/components/ChatInput.tsx";
import ChatInputEffects from "#app/features/chat/components/ChatInputEffects.tsx";
import { useEditorStore } from "#app/features/editor/stores/useEditorStore.ts";
import Message from "#app/features/message/components/Message.tsx";
import { uploadMutationKey } from "#app/features/upload/hooks/useUploads.ts";
import {
	deleteMessageMutationKey,
	sendMessageMutationKey,
} from "#client/src/features/chat/hooks/useMessaging.ts";
import { useMessagingStore } from "#client/src/features/chat/stores/useMessagingStore.ts";

function useElementHeight(initialHeight = 0): {
	ref: RefObject<HTMLDivElement | null>;
	height: number;
} {
	const ref = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(initialHeight);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;

		const observer = new ResizeObserver(() => {
			setHeight(el.clientHeight);
		});

		observer.observe(el);
		setHeight(el.clientHeight);
		return () => observer.disconnect();
	}, []);

	return { ref, height };
}

export default function Chat() {
	const { chat } = useChat();
	const { messages } = useMessages();

	const createTemporary = useChatStore((s) => s.createTemporary);
	const createIncognito = useChatStore((s) => s.createIncognito);
	const scrollRequested = useChatStore((s) =>
		chat.isFetching ? 0 : s.scrollRequested,
	);
	const scrollInstant = useChatStore((s) =>
		chat.isFetching ? 0 : s.scrollInstant,
	);

	const isMobile = useLayoutStore((s) => s.isMobile);
	const isInitializing = useLayoutStore((s) => s.isInitializing);

	const {
		viewportRef: viewportRef1,
		isAtBottom,
		scrollToBottom,
	} = useAutoScroll({
		scrollRequested,
		isInitializing,
	});

	// useAutoScroll holds the position across the prepended page.
	const { viewportRef: viewportRef2, sentinelRef } = useSentinel({
		query: messages,
		queryKey: client.query.message.getMessages.pathKey(),
	});

	const viewportRef = useMergedRef(viewportRef1, viewportRef2);

	useLayoutEffect(() => {
		if (scrollInstant > 0) {
			scrollToBottom("instant");
		}
	}, [scrollInstant, scrollToBottom]);

	const editing = useMessagingStore((s) => s.editing);
	const insertingAfter = useMessagingStore((s) => s.insertingAfter);
	const truncating = useMessagingStore((s) => s.truncating);

	const messageOpacities = useMemo(() => {
		const map = new Map<string, number>();
		let hasHitEdit = false;
		for (const message of messages.data?.pages.flatMap(
			(page) => page.messages,
		) ?? []) {
			if (!editing && !insertingAfter) {
				map.set(message.id, 1);
			} else if (message.id === editing?.id) {
				hasHitEdit = true;
				map.set(message.id, 1);
			} else if (
				!hasHitEdit ||
				(message.previousId !== editing?.id && !truncating)
			) {
				map.set(message.id, 0.5);
			} else {
				map.set(message.id, 0.1);
			}
		}
		return map;
	}, [messages, editing, insertingAfter, truncating]);

	const inputMaxWidth = 860;
	const inputRef = useRef<HTMLDivElement>(null);

	const { ref: inputEffectsRef, height: inputEffectsHeight } =
		useElementHeight();
	const { ref: chatContainerRef, height: chatContainerHeight } =
		useElementHeight(600);

	const greeting = useGreeting();
	const isNewChat = !chat.data;

	const isSendingMessage =
		useIsMutating({ mutationKey: sendMessageMutationKey }) > 0;
	const isDeletingMessage =
		useIsMutating({ mutationKey: deleteMessageMutationKey }) > 0;
	const isUploading = useIsMutating({ mutationKey: uploadMutationKey }) > 0;
	const isAny = useMemo(
		() =>
			isSendingMessage ||
			isDeletingMessage ||
			isUploading ||
			messages.isFetching ||
			((messages.data?.pages
				.flatMap((page) => page.messages)
				.some((message) => DataUtils.isMissingToolResult(message)) ??
				false) &&
				!editing),
		[
			isSendingMessage,
			isDeletingMessage,
			isUploading,
			messages.isFetching,
			editing,
			messages.data,
		],
	);

	const _key = useEditorStore((s) => s._key);

	return (
		<Stack h="100%" gap={0}>
			<ChatHeader fixed={true} />
			{/* Main content area */}
			<Box
				flex={1}
				pos="relative"
				mih={0}
				style={{ overflow: "hidden" }}
				ref={chatContainerRef}
			>
				{/* New chat hero overlay */}
				<Stack
					pos="absolute"
					inset={0}
					justify="center"
					align="center"
					gap={0}
					opacity={isNewChat ? 1 : 0}
					style={{
						transition: "opacity 400ms ease",
						pointerEvents: isNewChat ? "auto" : "none",
					}}
				>
					{/* Icon + title: cross-fade between incognito×temporary combinations */}
					<div style={{ display: "grid", placeItems: "center" }}>
						{/* Normal – New Chat */}
						<Stack
							align="center"
							gap={6}
							style={{
								gridArea: "1 / 1",
								opacity: !createIncognito && !createTemporary ? 1 : 0,
								transition: "opacity 300ms ease",
								willChange: "opacity",
								pointerEvents:
									!createIncognito && !createTemporary ? "auto" : "none",
							}}
						>
							<Text size="xl" fw={600} mt={4}>
								{greeting}
							</Text>
						</Stack>
						{/* Normal – Temporary Chat */}
						<Stack
							align="center"
							gap={6}
							style={{
								gridArea: "1 / 1",
								opacity: !createIncognito && createTemporary ? 1 : 0,
								transition: "opacity 300ms ease",
								willChange: "opacity",
								pointerEvents:
									!createIncognito && createTemporary ? "auto" : "none",
							}}
						>
							<Text size="xl" fw={600} mt={4}>
								{greeting}
							</Text>
						</Stack>
						{/* Incognito – New Chat */}
						<Stack
							align="center"
							gap={6}
							style={{
								gridArea: "1 / 1",
								opacity: createIncognito && !createTemporary ? 1 : 0,
								transition: "opacity 300ms ease",
								willChange: "opacity",
								pointerEvents:
									createIncognito && !createTemporary ? "auto" : "none",
							}}
						>
							<Text size="xl" fw={600} mt={4}>
								{greeting}
							</Text>
						</Stack>
						{/* Incognito – Temporary Chat */}
						<Stack
							align="center"
							gap={6}
							style={{
								gridArea: "1 / 1",
								opacity: createIncognito && createTemporary ? 1 : 0,
								transition: "opacity 300ms ease",
								willChange: "opacity",
								pointerEvents:
									createIncognito && createTemporary ? "auto" : "none",
							}}
						>
							<Text size="xl" fw={600} mt={4}>
								{greeting}
							</Text>
						</Stack>
					</div>
					{/* Subtitle: cross-fade between incognito states */}
					<Text
						size="sm"
						c="dimmed"
						style={{
							opacity: createTemporary ? 1 : 0,
							transition: "opacity 300ms ease",
							willChange: "opacity",
							pointerEvents: createTemporary ? "auto" : "none",
						}}
					>
						{createTemporary && "Chat will not be saved"}
						&nbsp;
					</Text>
				</Stack>

				{/* Messages scroll area */}
				<ScrollArea
					h="100%"
					pos="relative"
					styles={{
						scrollbar: {
							zIndex: "calc(var(--mantine-z-index-app) + 1)",
						},
					}}
					viewportRef={viewportRef}
					style={{
						opacity: isNewChat ? 0 : 1,
						transition: "opacity 400ms ease",
					}}
					flex={1}
					inset={0}
				>
					<Stack pt={isMobile ? 40 : 10} px={20} m="0 auto" maw={860} gap={10}>
						<Sentinel isFetching={messages.isFetching} ref={sentinelRef} />
						{messages.data?.pages
							.flatMap((page) => page.messages)
							.map((message) => (
								<Message
									key={message.id}
									message={message}
									opacity={messageOpacities.get(message.id) ?? 1}
									isLast={
										message.id ===
										messages.data?.pages.flatMap((page) => page.messages).at(-1)
											?.id
									}
								/>
							))}
						<Box mb={20}>
							<Actions />
						</Box>
					</Stack>
				</ScrollArea>
				<div
					style={{
						position: "absolute",
						inset: 0,
						pointerEvents: "none",
						maskImage:
							isMobile || chat.data
								? `linear-gradient(black 0px, transparent 40px ${chat.data ? `, transparent calc(100% - ${40 + inputEffectsHeight}px), black 100%` : ""})`
								: undefined,
						//maskImage: `linear-gradient(black ${isMobile ? 55 : 0}px, transparent ${isMobile ? 95 : 40}px, transparent calc(100% - ${40 + inputEffectsHeight}px), black 100%)`, // TODO - continue to refine
						background:
							isMobile || chat.data ? "var(--mantine-color-body)" : undefined,
					}}
				/>

				<Group
					gap={5}
					style={{
						position: "absolute",
						bottom: inputEffectsHeight + 16,
						right: 20,
						zIndex: "calc(var(--mantine-z-index-app) + 1)",
					}}
				>
					<Transition
						mounted={!isNewChat && !!chat.data?.unseen}
						transition="pop"
						duration={200}
						timingFunction="ease"
					>
						{(styles) => (
							<ActionIcon
								variant="filled"
								radius="xl"
								size="lg"
								style={{
									boxShadow: StyleUtils.shadow,
									...styles,
								}}
								onClick={() =>
									chat.data &&
									void ChatService.fetchChat({ client, id: chat.data.id })
								}
								loading={chat.isFetching}
								disabled={chat.isFetching}
							>
								<Icon icon="lucide:refresh-cw" height={18} />
							</ActionIcon>
						)}
					</Transition>
					<Transition
						mounted={!isAtBottom && !isNewChat}
						transition="slide-up"
						duration={200}
						timingFunction="ease"
					>
						{(styles) => (
							<ActionIcon
								variant="filled"
								radius="xl"
								size="lg"
								style={{
									boxShadow: StyleUtils.shadow,
									...styles,
								}}
								onClick={() => {
									scrollToBottom("smooth");
								}}
							>
								<Icon icon="lucide:chevrons-down" height={18} />
							</ActionIcon>
						)}
					</Transition>
				</Group>

				<ChatInputEffects
					inputEffectsRef={inputEffectsRef}
					chatContainerHeight={chatContainerHeight}
					inputMaxWidth={inputMaxWidth}
					isAny={isAny}
				/>
			</Box>

			{/* Input area */}
			<Box
				style={{
					background: chat.data ? "var(--mantine-color-body)" : "transparent",
				}}
			>
				<Box
					w="100%"
					maw={inputMaxWidth}
					m="0 auto"
					p={isMobile ? "0 10px 10px 10px" : "0 20px 20px 20px"}
					ref={inputRef}
				>
					<ChatInput key={_key} style={{ borderRadius: 25 }} isAny={isAny} />
				</Box>
			</Box>
		</Stack>
	);
}
