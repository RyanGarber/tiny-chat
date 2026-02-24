import {ActionIcon, Box, Button, Group, Modal, Stack, Text, Tooltip, Transition,} from "@mantine/core";
import {useClipboard, useDisclosure} from "@mantine/hooks";
import {IconArrowsSplit, IconCopy, IconEdit, IconIndentIncrease, IconTrash, IconX,} from "@tabler/icons-react";
import {useMessaging} from "@/managers/messaging.tsx";
import {useChats} from "@/managers/chats.tsx";
import MessageBody from "@/components/MessageBody.tsx";
import {MessageOmitted as MessageData} from "@tiny-chat/core-backend/types.ts";
import {extractText} from "@/utils.ts";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";
import {JSX} from "react";

export default function Message({
                                    message,
                                    opacity,
                                }: {
    message: MessageData;
    opacity: number;
}) {
    const {currentChat, cloneChat, messages} = useChats();
    const {
        editing,
        setEditing,
        insertingAfter,
        setInsertingAfter,
        deleteMessagePair,
    } = useMessaging();

    const [isMessageHovered, {open: onMessageHover, close: onMessageLeave}] =
        useDisclosure(false);
    const [isNodeHovered, {open: onNodeHover, close: onNodeLeave}] =
        useDisclosure(false);
    const [isConfirmingDelete, {open: onConfirmDelete, close: onCancelDelete}] =
        useDisclosure(false);
    const clipboard = useClipboard();

    const Divider = function ({messageId}: { messageId: string }) {
        return (
            <div
                style={{
                    flex: 1,
                    border: "none",
                    borderTop:
                        insertingAfter?.id === messageId
                            ? "2px solid #888888"
                            : "1px solid #444444",
                }}
            ></div>
        );
    };

    const actions: JSX.Element[] = [];
    if (messages.length > messages.indexOf(message) + 1) {
        actions.push(
            <Tooltip label="Insert" position="bottom" color="gray" key="insert">
                <ActionIcon
                    variant="subtle"
                    size={30}
                    onClick={() => setInsertingAfter(insertingAfter?.id !== message.id ? message : null)}
                >
                    {insertingAfter?.id === message.id ? (
                        <IconX size={20}/>
                    ) : (
                        <IconIndentIncrease size={20}/>
                    )}
                </ActionIcon>
            </Tooltip>
        );
    }
    if (!currentChat!.temporary) {
        actions.push(
            <Tooltip label="Fork" position="bottom" color="gray" key="fork">
                <ActionIcon
                    variant="subtle"
                    size={30}
                    onClick={() => cloneChat(message.id)}
                >
                    <IconArrowsSplit size={20}/>
                </ActionIcon>
            </Tooltip>
        );
    }

    return (
        <div>
            <div
                onMouseEnter={onMessageHover}
                onMouseLeave={onMessageLeave}
                style={{
                    display: "flex",
                    justifyContent: message.author === Author.USER ? "flex-end" : "flex-start",
                    padding: "10px 0",
                    opacity: opacity,
                    transition: "opacity 0.2s",
                }}
            >
                <Stack align={message.author === Author.USER ? "end" : "start"} w="100%">
                    <MessageBody message={message}/>
                    <Box w="100%" h={24}>
                        <Transition
                            mounted={message.author === Author.MODEL || isMessageHovered}
                            transition="slide-down"
                        >
                            {(styles) => (
                                <Group
                                    gap={5}
                                    justify={message.author === Author.USER ? "end" : "start"}
                                    style={styles}
                                >
                                    <Tooltip
                                        label={clipboard.copied ? "Copied" : "Copy"}
                                        position="bottom"
                                        color="gray"
                                    >
                                        <ActionIcon
                                            variant="transparent"
                                            size={20}
                                            onClick={() => {
                                                clipboard.copy(extractText(message.data));
                                            }}
                                        >
                                            <IconCopy size={20}/>
                                        </ActionIcon>
                                    </Tooltip>
                                    {message.author === Author.USER && (
                                        <>
                                            <Tooltip label="Edit" position="bottom" color="gray">
                                                <ActionIcon
                                                    variant="transparent"
                                                    size={20}
                                                    onClick={() => setEditing(editing?.id !== message.id ? message : null)}
                                                >
                                                    {editing?.id !== message.id ? (
                                                        <IconEdit size={20}/>
                                                    ) : (
                                                        <IconX size={20}/>
                                                    )}
                                                </ActionIcon>
                                            </Tooltip>
                                        </>
                                    )}
                                    <Tooltip label="Delete" position="bottom" color="gray">
                                        <ActionIcon
                                            variant="transparent"
                                            size={20}
                                            onClick={onConfirmDelete}
                                        >
                                            <IconTrash size={20}/>
                                        </ActionIcon>
                                    </Tooltip>
                                    {message.author === Author.MODEL && (
                                        <Text size="xs" c="dimmed">
                                            <span style={{paddingRight: 5}}>&middot;</span>{" "}
                                            {message.config.model}
                                        </Text>
                                    )}
                                </Group>
                            )}
                        </Transition>
                    </Box>
                </Stack>
            </div>
            {message.author === Author.MODEL && actions.length !== 0 && (
                <div
                    onMouseEnter={onNodeHover}
                    onMouseLeave={onNodeLeave}
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0",
                        opacity:
                            isNodeHovered || insertingAfter?.id === message.id ? 1 : 0.5,
                        transition: "opacity 0.2s",
                    }}
                >
                    <Divider messageId={message.id}></Divider>
                    <Box>{actions}</Box>
                    <Divider messageId={message.id}></Divider>
                </div>
            )}
            <Modal
                opened={isConfirmingDelete}
                onClose={onCancelDelete}
                title="Delete Message"
            >
                <Modal.Body>
                    <Button
                        color="red"
                        fullWidth
                        onClick={async () => {
                            await deleteMessagePair(message.id);
                            onCancelDelete();
                        }}
                    >
                        Confirm
                    </Button>
                </Modal.Body>
            </Modal>
        </div>
    );
}
