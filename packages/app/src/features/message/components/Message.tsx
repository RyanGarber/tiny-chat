import { Icon } from "@iconify/react";
import {
	ActionIcon,
	Box,
	Button,
	Group,
	Modal,
	Stack,
	Text,
	Tooltip,
} from "@mantine/core";
import { useClipboard, useDisclosure } from "@mantine/hooks";
import { useChat } from "@tiny-chat/client/src/features/chat/hooks/useChat.ts";
import { MessagingService } from "@tiny-chat/client/src/features/chat/services/MessagingService.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { type CSSProperties, memo, type ReactNode, useMemo } from "react";
import { client } from "#app/client.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import MessageBody from "#app/features/message/components/MessageBody.tsx";
import { useMessaging } from "#client/src/features/chat/hooks/useMessaging.ts";
import { useMessagingStore } from "#client/src/features/chat/stores/useMessagingStore.ts";
import { Author, type MessageState } from "#core/features/data/types/message";

const Message = memo(
	function Message({
		message,
		opacity,
		isLast,
	}: {
		message: MessageState;
		opacity: number;
		isLast: boolean;
	}) {
		const { chat, cloneChat } = useChat();
		const { deleteMessage } = useMessaging();

		const editing = useMessagingStore((s) => s.editing);
		const insertingAfter = useMessagingStore((s) => s.insertingAfter);

		const [isNodeHovered, { open: onNodeHover, close: onNodeLeave }] =
			useDisclosure(false);
		const [
			isConfirmingDelete,
			{ open: onConfirmDelete, close: onCancelDelete },
		] = useDisclosure(false);
		const clipboard = useClipboard();

		const actions: ReactNode[] = [];
		if (!isLast) {
			actions.push(
				<Tooltip
					label="Insert Here"
					position="bottom"
					color="gray"
					key="insert"
				>
					<ActionIcon
						variant="subtle"
						size={32}
						onClick={() =>
							MessagingService.setInsertingAfter({
								message: insertingAfter?.id !== message.id ? message : null,
							})
						}
					>
						{insertingAfter?.id === message.id ? (
							<Icon icon="lucide:x" width={20} />
						) : (
							<Icon icon="lucide:list-start" width={20} />
						)}
					</ActionIcon>
				</Tooltip>,
			);
		}
		if (!chat.data?.temporary) {
			actions.push(
				<Tooltip label="Fork Here" position="bottom" color="gray" key="clone">
					<ActionIcon
						variant="subtle"
						size={32}
						onClick={() =>
							chat.data &&
							cloneChat.mutate({ chat: chat.data, upToMessage: message })
						}
						loading={cloneChat.isPending}
						disabled={cloneChat.isPending}
					>
						<Icon icon="lucide:split" width={20} />
					</ActionIcon>
				</Tooltip>,
			);
		}

		// MessageBody's memo ends on `prev.style === next.style`. Rebuilding this
		// object every render made that check permanently false, so any re-render
		// of Message re-rendered the whole body, markdown included.
		const fade = useMemo(
			(): CSSProperties => ({
				opacity: opacity,
				transition: "opacity 0.2s",
			}),
			[opacity],
		);

		return (
			<div data-message-id={message.id}>
				<div
					style={{
						display: "flex",
						justifyContent:
							message.author === Author.USER ? "flex-end" : "flex-start",
						padding: "10px 0",
					}}
				>
					<Stack
						align={message.author === Author.USER ? "end" : "start"}
						w="100%"
					>
						<MessageBody message={message} style={fade} />
						<Box w="100%">
							<Group
								gap={0}
								justify={
									message.author === Author.USER ? "end" : "space-between"
								}
							>
								<Group gap={0} style={fade}>
									{message.author === Author.USER && (
										<Group c="dimmed" gap={5}>
											<Icon icon="lucide:send" height={14} />
											<Text
												size="xs"
												m={0}
												style={{
													whiteSpace: "nowrap",
													overflow: "hidden",
													textOverflow: "ellipsis",
													maxWidth: "33vw",
												}}
											>
												{message.config.model}
												<span style={{ padding: "0 5px 0 10px" }}>
													&middot;
												</span>
											</Text>
										</Group>
									)}
									<Tooltip
										label={clipboard.copied ? "Copied" : "Copy"}
										position="bottom"
										color="gray"
									>
										<ActionIcon
											variant="subtle"
											size={30}
											onClick={() => {
												clipboard.copy(
													DataUtils.getText({
														data: message.data,
														join: "\n",
													}),
												);
											}}
										>
											<Icon icon="lucide:copy" height={18} />
										</ActionIcon>
									</Tooltip>
									{message.author === Author.USER && (
										<Tooltip label="Edit" position="bottom" color="gray">
											<ActionIcon
												variant="subtle"
												size={30}
												onClick={() =>
													MessagingService.setEditing({
														client,
														message:
															editing?.id !== message.id ? message : null,
													})
												}
											>
												{editing?.id !== message.id ? (
													<Icon icon="lucide:edit" height={18} />
												) : (
													<Icon icon="lucide:x" height={18} />
												)}
											</ActionIcon>
										</Tooltip>
									)}
									<Tooltip label="Delete" position="bottom" color="gray">
										<ActionIcon
											variant="subtle"
											size={30}
											onClick={onConfirmDelete}
										>
											<Icon icon="lucide:trash" height={18} />
										</ActionIcon>
									</Tooltip>
									{message.author === Author.MODEL && (
										<Text
											size="xs"
											c="dimmed"
											style={{
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
												maxWidth: "33vw",
											}}
										>
											<span style={{ padding: "0 10px 0 5px" }}>&middot;</span>
											{message.config.model}
										</Text>
									)}
								</Group>
								{message.author === Author.MODEL && actions.length !== 0 && (
									<Box
										opacity={
											isNodeHovered || insertingAfter?.id === message.id
												? 1
												: 0.5
										}
										onMouseEnter={onNodeHover}
										onMouseLeave={onNodeLeave}
										style={{ transition: "opacity 0.2s" }}
									>
										{actions}
									</Box>
								)}
							</Group>
						</Box>
					</Stack>
				</div>
				<Modal
					opened={isConfirmingDelete}
					onClose={onCancelDelete}
					title="Delete Message"
					styles={{ content: StyleUtils.glass }}
					centered
				>
					<Button
						color="red"
						fullWidth
						onClick={() => {
							deleteMessage.mutate(message, {
								onSuccess: () => onCancelDelete(),
							});
						}}
						loading={deleteMessage.isPending}
						disabled={deleteMessage.isPending}
					>
						Confirm
					</Button>
				</Modal>
			</div>
		);
	},
	(prev, next) =>
		prev.opacity === next.opacity &&
		prev.message.id === next.message.id &&
		prev.message.data === next.message.data,
);

export default Message;
