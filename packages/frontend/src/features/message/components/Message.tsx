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
import { DataUtils } from "@tiny-chat/shared/src/features/data/utils/DataUtils.ts";
import { memo, type ReactNode } from "react";
import { useChat } from "#frontend/features/chat/hooks/useChat.ts";
import { useMessaging } from "#frontend/features/chat/hooks/useMessaging.ts";
import { useMessagingStore } from "#frontend/features/chat/stores/useMessagingStore.tsx";
import FileThumbnails from "#frontend/features/file/components/FileThumbnails.tsx";
import MessageBody from "#frontend/features/message/components/MessageBody.tsx";
import { GLASS_STYLE } from "#frontend/utils/style.ts";
import { Author, type MessageState } from "#shared/features/data/types/message";

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
		const setEditing = useMessagingStore((s) => s.setEditing);
		const insertingAfter = useMessagingStore((s) => s.insertingAfter);
		const setInsertingAfter = useMessagingStore((s) => s.setInsertingAfter);

		const [isNodeHovered, { open: onNodeHover, close: onNodeLeave }] =
			useDisclosure(false);
		const [
			isConfirmingDelete,
			{ open: onConfirmDelete, close: onCancelDelete },
		] = useDisclosure(false);
		const clipboard = useClipboard();

		const uploads = message.data.flat().filter((p) => p.type === "upload");

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
							setInsertingAfter(
								insertingAfter?.id !== message.id ? message : null,
							)
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

		const fade = {
			opacity: opacity,
			transition: "opacity 0.2s",
		};

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
								<Group gap={0} style={{ ...fade }}>
									{uploads.length !== 0 && (
										<Group gap={5} mr={10} style={{ ...fade }}>
											<Icon
												icon="lucide:paperclip"
												height={14}
												color="var(--mantine-color-dimmed)"
											/>
											<FileThumbnails
												uploads={uploads.map((u) => ({
													id: u.id,
													name: u.name,
													thumbnail: u.thumbnail,
												}))}
												size={22}
											/>
										</Group>
									)}
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
													setEditing(
														editing?.id !== message.id ? message : null,
													)
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
					styles={{ content: GLASS_STYLE }}
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
		prev.message.data === next.message.data &&
		prev.message.state === next.message.state,
);

export default Message;
