import { useContext } from "react";
import { ClientContext } from "#client/client.ts";
import { MessagingService } from "#client/features/chat/services/MessagingService.ts";
import { useChatStore } from "#client/features/chat/stores/useChatStore.ts";
import { useMessageQueueStore } from "#client/features/chat/stores/useMessageQueueStore.ts";
import { useMessagingStore } from "#client/features/chat/stores/useMessagingStore.ts";
import { DataUtils } from "#core/features/data/utils/DataUtils.ts";
import Box from "#tui/core/components/Box.tsx";
import Button from "#tui/core/components/Button.tsx";
import Text from "#tui/core/components/Text.tsx";

function Effect({
	content,
	onDelete,
}: {
	content: string;
	onDelete: () => void;
}) {
	return (
		<Box gap={1}>
			<Button label="×" onClick={onDelete} />
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

	const hasEffect =
		editing ||
		truncating ||
		insertingAfter ||
		(chatId && queues[chatId]?.length > 0);

	if (!hasEffect) return null;

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
