import {useEffect, useState} from "react";
import {useLayout} from "@/managers/layout.tsx";
import {ActionIcon, Button, Menu, Modal, NavLink, NavLinkProps, TextInput,} from "@mantine/core";
import {IconDots, IconEdit, IconTrash} from "@tabler/icons-react";
import {useDisclosure} from "@mantine/hooks";
import {useChats} from "@/managers/chats.tsx";
import {alert} from "@/utils.ts";
import {Chat} from "@tiny-chat/core-backend/generated/prisma/client.ts";

export default function SidebarChat({
                                        chat,
                                        props
                                    }: {
    chat: Chat;
    props: NavLinkProps
}) {
    const {currentChat, renameChat, deleteChat} = useChats();
    const {setGestureBlock} = useLayout();

    const [title, setTitle] = useState<string | null>(null);
    const [isEditOpen, {open: openEdit, close: closeEdit}] =
        useDisclosure(false);
    const [isDeleteOpen, {open: openDelete, close: closeDelete}] =
        useDisclosure(false);

    useEffect(() => {
        setGestureBlock(isEditOpen);
    }, [isEditOpen]);

    const saveTitle = async () => {
        if (!title) return;
        await renameChat(chat.id, title);
        closeEdit();
        alert("info", "Chat renamed");
    };

    const saveDelete = async () => {
        await deleteChat(chat.id);
        closeDelete();
        alert("info", "Chat deleted");
    }

    // TODO use @mantine/modals

    return (
        <>
            <NavLink
                key={chat.id}
                label={chat.title || "Generating..."}
                variant="filled"
                active={currentChat?.id === chat.id}
                {...props} // TODO - inherit props instead
                rightSection={
                    <Menu shadow="md" width={200}>
                        <Menu.Target>
                            <ActionIcon
                                size={24}
                                radius="xl"
                                variant="subtle"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <IconDots size={16}/>
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item
                                leftSection={<IconEdit size={16}/>}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setTitle(chat.title || "");
                                    openEdit();
                                }}
                            >
                                Rename
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconTrash size={16}/>}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openDelete();
                                }}
                            >
                                Delete
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                }
            />
            <Modal
                title="Rename Chat"
                opened={isEditOpen}
                onClose={closeEdit}
            >
                <TextInput
                    placeholder="Chat Title"
                    mb={10}
                    value={title || ""}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                    data-autofocus
                />
                <Button variant="gradient" fullWidth onClick={saveTitle}>
                    Save
                </Button>
            </Modal>
            <Modal
                title="Delete Chat"
                opened={isDeleteOpen}
                onClose={closeDelete}
            >
                <Modal.Body>
                    <Button color="red" fullWidth onClick={saveDelete}>
                        Confirm
                    </Button>
                </Modal.Body>
            </Modal>
        </>
    );
}
