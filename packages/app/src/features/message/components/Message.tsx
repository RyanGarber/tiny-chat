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
import {
	ArrowBendDownLeftIcon,
	CopyIcon,
	PaperPlaneTiltIcon,
	PenIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { MessagingService } from "@tiny-chat/client/src/features/chat/services/MessagingService.ts";
import { useMessageBranches } from "@tiny-chat/client/src/features/message/hooks/useMessageBranches.ts";
import type { Compaction } from "@tiny-chat/core/src/features/agent/services/AgentTokensService.ts";
import { DataUtils } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import type { CSSProperties, ReactNode } from "react";
import { client } from "#app/client.ts";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import MessageBody from "#app/features/message/components/MessageBody.tsx";
import { useMessaging } from "#client/src/features/chat/hooks/useMessaging.ts";
import { useMessagingStore } from "#client/src/features/chat/stores/useMessagingStore.ts";
import { Author, type MessageState } from "#core/features/data/types/message";

export default function Message({
	message,
	opacity,
	isLast,
	compaction,
}: {
	message: MessageState;
	opacity: number;
	isLast: boolean;
	compaction?: Compaction;
}) {
	const branch = useMessageBranches(message);
	const { deleteMessage } = useMessaging();

	const editing = useMessagingStore((s) => s.editing);
	const insertingAfter = useMessagingStore((s) => s.insertingAfter);

	const [isNodeHovered, { open: onNodeHover, close: onNodeLeave }] =
		useDisclosure(false);
	const [isConfirmingDelete, { open: onConfirmDelete, close: onCancelDelete }] =
		useDisclosure(false);
	const clipboard = useClipboard();

	const actions: ReactNode[] = [];
	if (!isLast) {
		actions.push(
			<Tooltip label="Insert Here" position="bottom" color="gray" key="insert">
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
						<XIcon size={20} />
					) : (
						<ArrowBendDownLeftIcon size={20} />
					)}
				</ActionIcon>
			</Tooltip>,
		);
	}

	const fade: CSSProperties = {
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
					<MessageBody message={message} style={fade} compaction={compaction} />
					<Box w="100%">
						<Group
							gap={0}
							justify={message.author === Author.USER ? "end" : "space-between"}
						>
							<Group gap={0} style={fade}>
								{message.author === Author.USER && branch.count > 1 && (
									<Group gap={4}>
										<ActionIcon
											variant="subtle"
											aria-label="Previous branch"
											disabled={branch.index <= 0}
											onClick={() => branch.select(-1)}
										>
											{"<"}
										</ActionIcon>
										<Text size="xs">
											{branch.index + 1} / {branch.count}
										</Text>
										<ActionIcon
											variant="subtle"
											aria-label="Next branch"
											disabled={branch.index >= branch.count - 1}
											onClick={() => branch.select(1)}
										>
											{">"}
										</ActionIcon>
										<Text size="xs" c="dimmed">
											<span style={{ padding: "0 10px 0 5px" }}>&middot;</span>
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
										<CopyIcon size={20} />
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
													message: editing?.id !== message.id ? message : null,
												})
											}
										>
											{editing?.id !== message.id ? (
												<PenIcon size={20} />
											) : (
												<XIcon size={20} />
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
										<TrashIcon size={20} />
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
										isNodeHovered || insertingAfter?.id === message.id ? 1 : 0.5
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
}
