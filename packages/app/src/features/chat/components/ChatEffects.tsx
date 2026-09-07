import { ActionIcon, Box, Group } from "@mantine/core";
import { XIcon } from "@phosphor-icons/react";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { ReactNode, Ref } from "react";
import { client } from "#app/client.ts";
import { useAppStore } from "#app/core/stores/useAppStore.ts";
import { MessagingService } from "#client/src/features/chat/services/MessagingService.ts";
import { useChatStore } from "#client/src/features/chat/stores/useChatStore.ts";

import { useMessageQueueStore } from "#client/src/features/chat/stores/useMessageQueueStore.ts";
import { useMessagingStore } from "#client/src/features/chat/stores/useMessagingStore.ts";

function Effect({
	content,
	onDelete,
	isAny,
}: {
	content: ReactNode;
	onDelete: () => void;
	isAny: boolean;
}) {
	return (
		<Group
			className="glass"
			align="center"
			gap={5}
			px={10}
			py={5}
			mr={5}
			mb={5}
			w="fit-content"
			bdrs={25}
			fz={14}
			opacity={isAny ? 0.5 : 1}
			style={{
				border: "1px solid var(--mantine-color-default-border)",
				pointerEvents: "auto",
			}}
		>
			<ActionIcon
				size={20}
				variant="subtle"
				color="dimmed"
				onClick={onDelete}
				disabled={isAny}
			>
				<XIcon size={20} />
			</ActionIcon>
			<Box>{content}</Box>
		</Group>
	);
}

export default function ChatEffects({
	inputEffectsRef,
	inputMaxWidth,
	disabled,
}: {
	inputEffectsRef: Ref<HTMLDivElement>;
	inputMaxWidth: number;
	disabled: boolean;
}) {
	const chatId = useChatStore((s) => s.chatId);
	const queues = useMessageQueueStore((s) => s.queues);
	const editing = useMessagingStore((s) => s.editing);
	const insertingAfter = useMessagingStore((s) => s.insertingAfter);
	const truncating = useMessagingStore((s) => s.truncating);
	const isMobile = useAppStore((s) => s.isMobile);
	return (
		<Group
			pos="absolute"
			bottom={0}
			left={isMobile ? 10 : 20}
			right={isMobile ? 10 : 20}
			justify="center"
			style={{
				pointerEvents: "none",
				zIndex: "calc(var(--mantine-z-index-app) + 1)",
			}}
		>
			<div style={{ width: "100%", maxWidth: inputMaxWidth - 40 }}>
				<Group gap={0} ref={inputEffectsRef}>
					{chatId &&
						queues[chatId]?.map((part) => (
							<Effect
								key={part.id}
								content={`Queued: ${DataUtils.getTextCleaned({ data: [part.value], maxLength: 60 }) || "Attachment"}`}
								onDelete={() =>
									useMessageQueueStore.getState().remove(chatId, part.id)
								}
								isAny={false}
							/>
						))}
					{editing && (
						<Effect
							content={
								<>
									Editing{" "}
									<span style={{ color: "#aaa" }}>
										{DataUtils.getTextCleaned({
											data: editing.data,
											maxLength: 20,
										})}
									</span>
								</>
							}
							onDelete={() =>
								MessagingService.setEditing({ client, message: null })
							}
							isAny={disabled}
						/>
					)}
					{editing && !truncating && (
						<Effect
							content="Keeping newer messages"
							onDelete={() =>
								MessagingService.setTruncating({ truncating: true })
							}
							isAny={disabled}
						/>
					)}
					{insertingAfter && (
						<Effect
							content={
								<>
									Inserting after{" "}
									<span style={{ color: "#aaa" }}>
										{DataUtils.getTextCleaned({
											data: insertingAfter.data,
											maxLength: 20,
										})}
									</span>
								</>
							}
							onDelete={() =>
								MessagingService.setInsertingAfter({ message: null })
							}
							isAny={disabled}
						/>
					)}
				</Group>
			</div>
		</Group>
	);
}
