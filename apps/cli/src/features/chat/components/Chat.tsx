import { useGreeting } from "@tiny-chat/client/src/core/hooks/useGreeting.ts";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { MessageProvider } from "@tiny-chat/client/src/features/message/components/MessageProvider.tsx";
import { useMessages } from "@tiny-chat/client/src/features/message/hooks/useMessages.ts";
import { useMemo } from "react";
import Box from "../../../core/components/Box.tsx";
import ScrollView from "../../../core/components/ScrollView.tsx";
import Text from "../../../core/components/Text.tsx";
import { useSentinel } from "../../../core/hooks/useSentinel.ts";
import { useWorkingStatus } from "../../../core/hooks/useWorkingStatus.ts";
import Message from "../../message/components/Message.tsx";

export default function Chat() {
	const { chat } = useChat();
	const { messages } = useMessages();
	useWorkingStatus(chat, messages);

	const messageList = useMemo(
		() => messages.data?.pages.flatMap((page) => page.messages) ?? [],
		[messages.data],
	);

	// Older messages live off the top of the transcript, so reaching it is what
	// asks for the next page.
	const fetchOlder = useSentinel(messages);

	const greeting = useGreeting();

	if (!chat.data) {
		return (
			<Box flexGrow={1} justifyContent="center" alignItems="center">
				<Text color="textSubtle">{greeting.toLowerCase()}</Text>
			</Box>
		);
	}

	return (
		// The provider wraps the view rather than the list: every message has to
		// stay a direct child of the ScrollView for it to measure and position
		// them individually.
		<MessageProvider>
			<ScrollView
				flexGrow={1}
				flexShrink={1}
				flexBasis={0}
				minHeight={0}
				stickToBottom
				resetKey={chat.data.id}
				onReachTop={fetchOlder}
			>
				{messageList.map((message) => (
					<Message key={message.id} message={message} />
				))}
			</ScrollView>
		</MessageProvider>
	);
}
