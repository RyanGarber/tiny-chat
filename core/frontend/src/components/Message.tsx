import {ActionIcon, Box, Button, Group, Modal, Stack, Text, Tooltip, Transition,} from "@mantine/core";
import {useClipboard, useDisclosure} from "@mantine/hooks";
import {useMessaging} from "@/managers/messaging.tsx";
import {useChats} from "@/managers/chats.tsx";
import MessageBody from "@/components/MessageBody.tsx";
import {MessageOmitted as MessageData} from "@tiny-chat/core-backend/types.ts";
import {extractText} from "@/utils.ts";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";
import {JSX} from "react";
import {Icon} from "@iconify/react";

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
                            ? "2px solid var(--mantine-color-dimmed)"
                            : "1px solid var(--mantine-color-default-border)",
                }}
            ></div>
        );
    };

    const actions: JSX.Element[] = [];
    if (messages.length > messages.indexOf(message) + 1) {
        actions.push(
            <Tooltip label="Insert Here" position="bottom" color="gray" key="insert">
                <ActionIcon
                    variant="subtle"
                    size={32}
                    onClick={() => setInsertingAfter(insertingAfter?.id !== message.id ? message : null)}
                >
                    {insertingAfter?.id === message.id ? (
                        <Icon icon="lucide:x" width={20}/>
                    ) : (
                        <Icon icon="lucide:list-start" width={20}/>
                    )}
                </ActionIcon>
            </Tooltip>
        );
    }
    if (!currentChat!.temporary) {
        actions.push(
            <Tooltip label="Fork Here" position="bottom" color="gray" key="clone">
                <ActionIcon
                    variant="subtle"
                    size={32}
                    onClick={() => cloneChat(message.id)}
                >
                    <Icon icon="lucide:split" width={20}/>
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
                    <Box w="100%" h={30}>
                        <Transition
                            mounted={message.author === Author.MODEL || isMessageHovered}
                            transition="slide-down"
                        >
                            {(styles) => (
                                <Group
                                    gap={0}
                                    justify={message.author === Author.USER ? "end" : "start"}
                                    style={styles}
                                >
                                    <Tooltip
                                        label={clipboard.copied ? "Copied" : "Copy"}
                                        position="bottom"
                                        color="gray"
                                    >
                                        <ActionIcon
                                            variant="subtle"
                                            size={30}
                                            onClick={() => {
                                                clipboard.copy(extractText(message.data));
                                            }}
                                        >
                                            <Icon icon="lucide:copy" height={18}/>
                                        </ActionIcon>
                                    </Tooltip>
                                    {message.author === Author.USER && (
                                        <>
                                            <Tooltip label="Edit" position="bottom" color="gray">
                                                <ActionIcon
                                                    variant="subtle"
                                                    size={30}
                                                    onClick={() => setEditing(editing?.id !== message.id ? message : null)}
                                                >
                                                    {editing?.id !== message.id ? (
                                                        <Icon icon="lucide:edit" height={18}/>
                                                    ) : (
                                                        <Icon icon="lucide:x" height={18}/>
                                                    )}
                                                </ActionIcon>
                                            </Tooltip>
                                        </>
                                    )}
                                    <Tooltip label="Delete" position="bottom" color="gray">
                                        <ActionIcon
                                            variant="subtle"
                                            size={30}
                                            onClick={onConfirmDelete}
                                        >
                                            <Icon icon="lucide:trash" height={18}/>
                                        </ActionIcon>
                                    </Tooltip>
                                    {message.author === Author.MODEL && (
                                        <Text size="xs" c="dimmed">
                                            <span style={{padding: "0 5px"}}>&middot;</span>
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
            </Modal>
        </div>
    );
}
