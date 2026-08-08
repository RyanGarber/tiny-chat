import { useGreeting } from "@tiny-chat/client/src/core/hooks/useGreeting.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { MessageContextProvider } from "@tiny-chat/client/src/features/message/components/MessageContext.tsx";
import { useMessages } from "@tiny-chat/client/src/features/message/hooks/useMessages.ts";
import { Box, Text, useInput, useStdout } from "ink";
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAutoScroll } from "../../../core/hooks/useAutoScroll.ts";
import { useScrollWheel } from "../../../core/hooks/useScrollWheel.ts";
import { useSentinel } from "../../../core/hooks/useSentinel.ts";
import { useStreamMeasure } from "../../../core/hooks/useStreamMeasure.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Message from "../../message/components/Message.tsx";
import { useChatStore } from "../stores/useChatStore.ts";

export default function Chat() {
	const { stdout } = useStdout();

	const { chat } = useChat();
	const { messages } = useMessages();
	useWorkingStatus(chat, messages);

	const scrollRef = useRef<ScrollViewRef>(null);

	const messageList = useMemo(
		() => messages.data?.pages.flatMap((page) => page.messages) ?? [],
		[messages.data],
	);

	const {
		isAtBottomRef,
		pinToBottom,
		onScroll: onAutoScroll,
	} = useAutoScroll({ scrollRef, resetKey: chat.data?.id });

	useScrollWheel({ scrollRef, step: 3 });

	useStreamMeasure({
		scrollRef,
		chatId: chat.data?.id,
		getIndex: useCallback(
			(messageId: string) =>
				messageList.findIndex((message) => message.id === messageId),
			[messageList],
		),
	});

	useEffect(() => {
		const handleResize = () => {
			scrollRef.current?.remeasure();
			// Remeasuring only lands on the next commit, so follow it up after.
			setTimeout(pinToBottom, 0);
		};
		stdout?.on("resize", handleResize);
		return () => {
			stdout?.off("resize", handleResize);
		};
	}, [stdout, pinToBottom]);

	// Holds the message the viewport was resting on while an older page loads in
	// above it, so the terminal does not jump by the height of the new page.
	const anchorRef = useRef<{ id: string; offset: number } | null>(null);
	const isAnchoringRef = useRef(false);

	const { onScroll: checkSentinel, onViewportSizeChange } = useSentinel({
		scrollRef,
		query: messages,
		edge: "top",
		onFetchNextPage: useCallback(() => {
			const view = scrollRef.current;
			const oldest = messageList[0];
			// While pinned to the bottom, autoscroll owns the offset.
			if (!view || !oldest || isAtBottomRef.current) return;
			anchorRef.current = { id: oldest.id, offset: view.getScrollOffset() };
		}, [messageList, isAtBottomRef]),
	});

	const restoreAnchor = useCallback(() => {
		const view = scrollRef.current;
		const anchor = anchorRef.current;
		if (!view || !anchor) return;

		const index = messageList.findIndex((message) => message.id === anchor.id);
		// Nothing has been prepended yet, so there is nothing to compensate for.
		if (index <= 0) return;

		const position = view.getItemPosition(index);
		if (!position) return;

		isAnchoringRef.current = true;
		view.scrollTo(position.top + anchor.offset);
		isAnchoringRef.current = false;
	}, [messageList]);

	const handleScroll = useCallback(
		(offset: number) => {
			// Any scroll we did not make ourselves invalidates the anchor.
			if (!isAnchoringRef.current) anchorRef.current = null;
			onAutoScroll(offset);
			checkSentinel(offset);
		},
		[onAutoScroll, checkSentinel],
	);

	const handleContentHeightChange = useCallback(() => {
		restoreAnchor();
		pinToBottom();
		checkSentinel();
	}, [restoreAnchor, pinToBottom, checkSentinel]);

	const expanded = useChatStore((state) => state.expanded);
	const setExpanded = useChatStore((state) => state.setExpanded);

	useInput((input, key) => {
		if (key.ctrl && input === "e") {
			setExpanded(!expanded);
		}
	});

	const greeting = useGreeting();

	if (!chat.data) {
		return (
			<Box flexGrow={1} justifyContent="center" alignItems="center">
				<Text>{greeting}</Text>
			</Box>
		);
	}

	return (
		// The provider wraps the view rather than the list: every message has to
		// stay a direct child of the ScrollView for it to measure and position
		// them individually.
		<MessageContextProvider>
			<ScrollView
				ref={scrollRef}
				flexGrow={1}
				flexShrink={1}
				flexBasis={0}
				minHeight={0}
				flexDirection="column"
				alignItems={chat.data ? "flex-start" : "center"}
				onScroll={handleScroll}
				onContentHeightChange={handleContentHeightChange}
				onViewportSizeChange={onViewportSizeChange}
			>
				{messageList.map((message) => (
					<Message key={message.id} message={message} expanded={expanded} />
				))}
			</ScrollView>
		</MessageContextProvider>
	);
}
