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
import { ChatService } from "@tiny-chat/client/src/features/chat/services/ChatService.ts";
import { useChatStore } from "@tiny-chat/client/src/features/chat/stores/useChatStore.ts";
import { useDisabled } from "@tiny-chat/client/src/features/editor/hooks/useDisabled.ts";
import { MessageProvider } from "@tiny-chat/client/src/features/message/components/MessageProvider.tsx";
import { useMessages } from "@tiny-chat/client/src/features/message/hooks/useMessages.ts";
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
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import Actions from "#app/features/chat/components/Actions.tsx";
import ChatEffects from "#app/features/chat/components/ChatEffects.tsx";
import ChatHeader from "#app/features/chat/components/ChatHeader.tsx";
import { Editor } from "#app/features/editor/components/Editor.tsx";
import { useEditorStore } from "#app/features/editor/stores/useEditorStore.ts";
import Message from "#app/features/message/components/Message.tsx";
import { useMessagingStore } from "#client/src/features/chat/stores/useMessagingStore.ts";
import { uploadMutationKey } from "#client/src/features/upload/hooks/useUploads.ts";

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

	const isMobile = useAppStore((s) => s.isMobile);

	const {
		viewportRef: viewportRef1,
		isAtBottom,
		scrollToBottom,
	} = useAutoScroll({
		scrollRequested,
		scrollPaused: chat.isFetching || messages.isFetching,
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

	const messageList = useMemo(
		() => messages.data?.pages.flatMap((page) => page.messages) ?? [],
		[messages.data],
	);
	const lastMessageId = messageList.at(-1)?.id;

	const messageOpacities = useMemo(() => {
		const map = new Map<string, number>();
		let hasHitEdit = false;
		for (const message of messageList) {
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
	}, [messageList, editing, insertingAfter, truncating]);

	const inputMaxWidth = 860;
	const inputRef = useRef<HTMLDivElement>(null);

	const { ref: inputEffectsRef, height: inputEffectsHeight } =
		useElementHeight();
	const { ref: chatContainerRef } = useElementHeight(600);

	const greeting = useGreeting();
	const isNewChat = !chat.data;

	const isUploading = useIsMutating({ mutationKey: uploadMutationKey }) > 0;
	const { disabled } = useDisabled({ disabled: isUploading });

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
						{createTemporary && "Temporary chat"}
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
						<MessageProvider>
							{messageList.map((message) => (
								<Message
									key={message.id}
									message={message}
									opacity={messageOpacities.get(message.id) ?? 1}
									isLast={message.id === lastMessageId}
								/>
							))}
						</MessageProvider>
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

				<ChatEffects
					inputEffectsRef={inputEffectsRef}
					inputMaxWidth={inputMaxWidth}
					disabled={disabled}
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
					<Editor key={_key} style={{ borderRadius: 25 }} disabled={disabled} />
				</Box>
			</Box>
		</Stack>
	);
}
