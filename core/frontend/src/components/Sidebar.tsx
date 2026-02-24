import {useEffect, useState} from "react";
import {ActionIcon, Avatar, Burger, Divider, Group, NavLink, ScrollArea, Space, Stack, Tooltip} from "@mantine/core";
import {Spotlight, spotlight, SpotlightActionData} from "@mantine/spotlight";
import {useLayout} from "@/managers/layout.tsx";
import {IconEyeOff, IconHexagonPlus, IconSearch, IconSettings2, IconUserHexagon} from "@tabler/icons-react";
import SidebarChat from "@/components/SidebarChat.tsx";
import {useChats} from "@/managers/chats.tsx";
import {useLocation} from "wouter";
import {auth, extractText, scrubText, snippetText, trpc} from "@/utils.ts";
import Drawers from "@/components/Drawers.tsx";
import {useMessaging} from "@/managers/messaging.tsx";

export default function Sidebar() {
    const {folders, currentChat, setCurrentChat} = useChats();
    const {isMobile, isSidebarOpen, setSidebarOpen} = useLayout();
    const {temporary, setTemporary} = useMessaging();

    const {data: session, isPending: isSessionPending} = auth.useSession();

    const [location] = useLocation();
    useEffect(() => {
        if (isSessionPending || !session?.user) return;
        if (window.location.hash.length < 2) window.location.hash = "#/";
        if (!window.location.hash.startsWith("#/app/")) void setCurrentChat(location.slice(1) || null, false);
    }, [location, isSessionPending, session?.user?.id]);

    const closeAfter = (action?: () => void) => {
        action?.();
        if (isMobile) setSidebarOpen(false);
    }

    const isTempActive = temporary || currentChat?.temporary;

    const [searchQuery, setSearchQuery] = useState('');
    const [spotlightActions, setSpotlightActions] = useState<SpotlightActionData[]>([]); // TODO - SpotlightActionGroup

    useEffect(() => {
        if (!(searchQuery.trim()?.length >= 3)) {
            setSpotlightActions([]);
            return;
        }
        // TODO - use useDebouncedState?
        const timeout = setTimeout(async () => {
            const results = await trpc.chats.search.query({query: searchQuery});
            console.log("Results for", searchQuery, results);
            const seen = new Set<string>();
            setSpotlightActions(
                results
                    .filter((r) => {
                        if (seen.has(r.chatId)) return false;
                        seen.add(r.chatId);
                        return true;
                    })
                    .map((r) => ({
                        id: r.id,
                        label: scrubText(r.chatTitle, 50),
                        description: snippetText(scrubText(extractText(r.data)), searchQuery),
                        onClick: () => closeAfter(() => void setCurrentChat(r.chatId)), // TODO - scroll to chat
                    }))
            );
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const expanded = (
        <>
            <Group justify="space-between" px={5} pb={5}>
                <ActionIcon variant="transparent" onClick={spotlight.open}>
                    <IconSearch size={18} color="lightgray"/>
                </ActionIcon>
                <Spotlight
                    actions={spotlightActions}
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                    highlightQuery
                    scrollAreaProps={{mah: 400}}
                />
                <Burger opened={isSidebarOpen} onClick={() => setSidebarOpen(!isSidebarOpen)} size={16}/>
            </Group>
            <Group align="center" mt={5} gap={5}>
                <NavLink label="New Chat" leftSection={<IconHexagonPlus size={20}/>} className="new-chat"
                         onClick={() => closeAfter(() => void setCurrentChat(null))} active={!currentChat}
                         variant="subtle"
                         flex={1} bdrs="md"/>
                <ActionIcon size={40} variant="subtle" c="dimmed" bdrs="md" className="nav-link-like filled"
                            onClick={() => closeAfter(() => void setTemporary(!isTempActive))}
                            data-active={isTempActive}>
                    <IconEyeOff size={20}/>
                </ActionIcon>
            </Group>
            <Divider my="sm"/>
            <ScrollArea flex={1}>
                <Stack gap={5}>
                    {folders.map((folder) =>
                        folder.chats.length === 1 ? (
                            <SidebarChat
                                key={folder.chats[0].id}
                                chat={folder.chats[0]}
                                props={{
                                    onClick: () => closeAfter(() => void setCurrentChat(folder.chats[0].id)),
                                    bdrs: 'md'
                                }}
                            />
                        ) : (
                            <NavLink
                                key={folder.id}
                                label={folder.title || "Generating..."}
                                leftSection={folder.chats.length}
                                defaultOpened={true}
                            >
                                {folder.chats.map((chat) => (
                                    <SidebarChat
                                        key={chat.id}
                                        chat={chat}
                                        props={{
                                            onClick: () => closeAfter(() => void setCurrentChat(chat.id)),
                                            bdrs: 'md'
                                        }}
                                    />
                                ))}
                            </NavLink>
                        ),
                    )}
                </Stack>
            </ScrollArea>
            <Divider my="sm"/>
            <Drawers buttons={(account, settings) => (
                <>
                    <NavLink
                        label={!session?.user || session.user.isAnonymous ? 'Sign In' : session.user.name.split(' ')[0]}
                        leftSection={session?.user?.image ? <Avatar src={session.user.image} size={20}/> :
                            <IconUserHexagon size={20}/>}
                        onClick={account[1].open} bdrs="md"/>
                    <NavLink label="Settings" leftSection={<IconSettings2 size={20}/>} onClick={settings[1].open}
                             bdrs="md"/>
                </>
            )}/>
        </>
    );

    const collapsed = (
        <Stack align="center" justify="space-between" h="100%" gap={0} py={4}>
            <Stack align="center" gap={5}>
                <Burger opened={isSidebarOpen} onClick={() => setSidebarOpen(!isSidebarOpen)} size={16}/>
                <Space/>
                <Tooltip label="New Chat" position="right" color="gray">
                    <ActionIcon variant="subtle" size={36} className="new-chat nav-link-like"
                                data-active={!currentChat}
                                onClick={() => closeAfter(() => void setCurrentChat(null))}>
                        <IconHexagonPlus size={20} color="lightgray"/>
                    </ActionIcon>
                </Tooltip>
            </Stack>
            <Drawers buttons={(account, settings) => (
                <Stack align="center" gap={5}>
                    <Tooltip
                        label={!session?.user || session.user.isAnonymous ? 'Sign In' : session.user.name.split(' ')[0]}
                        position="right" color="gray">
                        <ActionIcon variant="subtle" onClick={account[1].open} size={36} className="nav-link-like">
                            {session?.user?.image
                                ? <Avatar src={session.user.image} size={20}/>
                                : <IconUserHexagon size={20}/>}
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Settings" position="right" color="gray">
                        <ActionIcon variant="subtle" onClick={settings[1].open} size={36} className="nav-link-like">
                            <IconSettings2 size={20} color="lightgray"/>
                        </ActionIcon>
                    </Tooltip>
                </Stack>
            )}/>
        </Stack>
    );

    if (isMobile) {
        return expanded;
    }

    return (
        <div style={{position: "relative", height: "100%", overflow: "hidden"}}>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    opacity: isSidebarOpen ? 1 : 0,
                    visibility: isSidebarOpen ? "visible" : "hidden",
                    transition: "opacity 200ms ease 50ms, visibility 0ms linear " + (isSidebarOpen ? "0ms" : "250ms"),
                    display: "flex",
                    flexDirection: "column"
                }}
            >
                {expanded}
            </div>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    opacity: isSidebarOpen ? 0 : 1,
                    visibility: isSidebarOpen ? "hidden" : "visible",
                    transition: "opacity 200ms ease 50ms, visibility 0ms linear " + (isSidebarOpen ? "250ms" : "0ms"),
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {collapsed}
            </div>
        </div>
    );
}