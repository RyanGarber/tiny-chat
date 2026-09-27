import { ClientContext } from "@tiny-chat/client/client.ts";
import { MessagingService } from "@tiny-chat/client/features/chat/services/MessagingService.ts";
import { useChatStore } from "@tiny-chat/client/features/chat/stores/useChatStore.ts";
import { useMessageQueueStore } from "@tiny-chat/client/features/chat/stores/useMessageQueueStore.ts";
import { useMessagingStore } from "@tiny-chat/client/features/chat/stores/useMessagingStore.ts";
import { DataUtils } from "@tiny-chat/core/features/data/utils/DataUtils.ts";
import { useContext, useState } from "react";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import { useMouseInput } from "../../../core/hooks/useMouseInput.ts";

function Effect({
	content,
	onDelete,
}: {
	content: string;
	onDelete: () => void;
}) {
	const [hover, setHover] = useState(false);
	const { mouseRef } = useMouseInput({
		onClick: onDelete,
		onHoverStart: () => setHover(true),
		onHoverEnd: () => setHover(false),
	});
	return (
		<Box gap={1}>
			<Box ref={(element) => mouseRef(element, 0)}>
				<Text color="textSubtle" dimColor={hover}>
					[×]
				</Text>
			</Box>
			<Text>{content}</Text>
		</Box>
	);
}
export default function ChatEffects() {
	const client = useContext(ClientContext);
	const chatId = useChatStore((s) => s.chatId);
	const queues = useMessageQueueStore((s) => s.queues);
	const editing = useMessagingStore((s) => s.editing);
	const truncating = useMessagingStore((s) => s.truncating);
	const insertingAfter = useMessagingStore((s) => s.insertingAfter);
	return (
		<Box flexDirection="column" paddingX={2} paddingBottom={1}>
			{editing && (
				<Effect
					content={`editing ${DataUtils.getTextCleaned({ data: editing.data, maxLength: 40 }).toLowerCase()}`}
					onDelete={() =>
						MessagingService.setEditing({ client, message: null })
					}
				/>
			)}
			{editing && !truncating && (
				<Effect
					content="keeping newer messages"
					onDelete={() => MessagingService.setTruncating({ truncating: true })}
				/>
			)}
			{insertingAfter && (
				<Effect
					content={`inserting after ${DataUtils.getTextCleaned({ data: insertingAfter.data, maxLength: 40 }).toLowerCase()}`}
					onDelete={() => MessagingService.setInsertingAfter({ message: null })}
				/>
			)}
			{chatId &&
				queues[chatId]?.map((part) => (
					<Effect
						key={part.id}
						content={`Queued: ${DataUtils.getTextCleaned({ data: [part.value], maxLength: 60 }) || "Attachment"}`}
						onDelete={() =>
							useMessageQueueStore.getState().remove(chatId, part.id)
						}
					/>
				))}
		</Box>
	);
}
