import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { useMessages } from "@tiny-chat/client/src/features/chat/hooks/useMessages.ts";
import { useStdout } from "ink";
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAutoScroll } from "../../../core/hooks/useAutoScroll.ts";
import { useLoadingStatus } from "../../../core/hooks/useLoadingStatus.ts";
import { useScrollWheel } from "../../../core/hooks/useScrollWheel.ts";
import { useSentinel } from "../../../core/hooks/useSentinel.ts";
import Message from "../../message/components/Message.tsx";

export default function Chat() {
	const { chat } = useChat();
	const { messages } = useMessages();
	useLoadingStatus(messages);

	const scrollRef = useRef<ScrollViewRef>(null);
	const { stdout } = useStdout();

	useScrollWheel({ scrollRef });

	const messageList = useMemo(
		() => messages.data?.pages.flatMap((page) => page.messages) ?? [],
		[messages.data],
	);

	const {
		isAtBottomRef,
		pinToBottom,
		onScroll: onAutoScroll,
	} = useAutoScroll({ scrollRef, resetKey: chat.data?.id });

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

	return (
		<ScrollView
			ref={scrollRef}
			height="100%"
			flexGrow={1}
			flexDirection="column"
			alignItems={chat.data ? "flex-start" : "center"}
			onScroll={handleScroll}
			onContentHeightChange={handleContentHeightChange}
			onViewportSizeChange={onViewportSizeChange}
		>
			{messageList.map((message) => (
				<Message key={message.id} message={message} />
			))}
		</ScrollView>
	);
}
