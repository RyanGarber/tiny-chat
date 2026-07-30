import { Text, useStdout } from "ink";
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import { useEffect, useRef } from "react";
import { useScrollWheel } from "../../../core/hooks/useScrollWheel.ts";
import { useChat } from "../hooks/useChat.ts";
import { useMessages } from "../hooks/useMessages.tsx";
import Message from "./Message.tsx";

export default function Chat() {
	const { chat } = useChat();
	const { messages } = useMessages();

	const scrollRef = useRef<ScrollViewRef>(null);
	const { stdout } = useStdout();

	useEffect(() => {
		const handleResize = () => scrollRef.current?.remeasure();
		stdout?.on("resize", handleResize);
		return () => {
			stdout?.off("resize", handleResize);
		};
	}, [stdout]);

	useScrollWheel({ scrollRef });

	return (
		<ScrollView
			ref={scrollRef}
			height="100%"
			flexGrow={1}
			flexDirection="column"
			alignItems={chat.data ? "flex-start" : "center"}
		>
			{messages.data?.pages
				.flatMap((page) => page.messages)
				.map((message) => (
					<Message key={message.id} message={message} />
				))}
			<Text dimColor>[end of chat]</Text>
		</ScrollView>
	);
}
