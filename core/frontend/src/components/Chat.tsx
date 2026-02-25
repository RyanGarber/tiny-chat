import {useCallback, useEffect, useLayoutEffect, useRef, useState,} from "react";
import {Box, Group, ScrollArea, Stack, Text, ThemeIcon} from "@mantine/core";
import {IconEyeOff, IconMessageCirclePlus} from "@tabler/icons-react";
import Message from "@/components/Message.tsx";
import {useMessaging} from "@/managers/messaging.tsx";
import {useLayout} from "@/managers/layout.tsx";
import InputEffect from "@/components/InputEffect.tsx";
import {useChats} from "@/managers/chats.tsx";
import Input from "@/components/Input.tsx";
import {extractText, scrubText} from "@/utils.ts";
import Attachments from "@/components/Attachments.tsx";

const SCROLL_BOTTOM_THRESHOLD = 80;

export default function Chat() {
    const {
        currentChat,
        messages,
    } = useChats();

    const {
        files,
        removeFile,
        editing,
        setEditing,
        truncating,
        setTruncating,
        insertingAfter,
        setInsertingAfter,
        temporary,
        scrollRequested,
    } = useMessaging();

    const {isMobile, shadow, isInitializing, isMessaging, getSidebarWidth} = useLayout();

    const messagesViewportRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const smoothScrollVersionRef = useRef(0);
    const isSmoothScrollingRef = useRef(false);

    const hasBeenNewChat = useRef(false);

    const checkIsAtBottom = useCallback(() => {
        const el = messagesViewportRef.current;
        if (!el) return true;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        return distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
    }, []);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'instant') => {
        const el = messagesViewportRef.current;
        if (!el) return;
        if (behavior === 'smooth') {
            const version = ++smoothScrollVersionRef.current;
            isSmoothScrollingRef.current = true;
            el.scrollTo({top: el.scrollHeight, behavior: 'smooth'});
            const onEnd = () => {
                // Ignore stale callbacks from cancelled animations
                if (smoothScrollVersionRef.current !== version) return;
                isSmoothScrollingRef.current = false;
                isAtBottomRef.current = checkIsAtBottom();
            };
            el.addEventListener('scrollend', onEnd, {once: true});
            setTimeout(onEnd, 600);
        } else {
            el.scrollTop = el.scrollHeight;
        }
    }, [checkIsAtBottom]);

    const handleScroll = useCallback(() => {
        isAtBottomRef.current = checkIsAtBottom();
    }, [checkIsAtBottom]);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        let prevHeight = vv.height;

        const onResize = () => {
            const el = messagesViewportRef.current;
            if (!el) return;

            const newHeight = vv.height;
            const delta = prevHeight - newHeight;
            prevHeight = newHeight;

            if (Math.abs(delta) < 1) return;

            if (isAtBottomRef.current) el.scrollTop = el.scrollHeight;
            else if (delta > 0) el.scrollTop += delta;
        };

        vv.addEventListener("resize", onResize);
        return () => vv.removeEventListener("resize", onResize);
    }, [scrollToBottom]);

    useLayoutEffect(() => {
        if (isAtBottomRef.current) {
            scrollToBottom();
        }
    }, [messages, messages[messages.length - 1]?.data, scrollToBottom]);

    useEffect(() => {
        if (scrollRequested > 0 && !isInitializing) {
            isAtBottomRef.current = true;
            scrollToBottom('smooth');
        }
    }, [scrollRequested, scrollToBottom, isInitializing]);

    const inputMaxWidth = 860;
    const inputRef = useRef<HTMLDivElement>(null);
    const [isInputMaxWidth, setIsInputMaxWidth] = useState(
        window.innerWidth > 860 + getSidebarWidth(),
    );

    useLayoutEffect(() => {
        const handleResize = () => {
            setIsInputMaxWidth(
                (inputRef.current?.clientWidth ?? window.innerWidth - getSidebarWidth()) >=
                inputMaxWidth,
            );
        };
        const observer = new ResizeObserver(() => handleResize());
        if (inputRef.current) observer.observe(inputRef.current);
        handleResize();
        return () => observer.disconnect();
    }, [inputRef.current]);

    let hasHitEdit = false;
    const getMessageOpacity = (message: { id: string }) => {
        if (!editing && !insertingAfter) return 1;
        if (message.id === editing?.id) {
            hasHitEdit = true;
            return 1;
        }
        return hasHitEdit && truncating ? 0.1 : 0.5;
    };

    const isNewChat = currentChat === null && !isInitializing;

    useEffect(() => {
        if (isNewChat) hasBeenNewChat.current = true;
    }, [isNewChat]);

    return (
        <Stack h="100%" gap={0} px={!isInputMaxWidth && !currentChat ? 20 : 0}>
            {/* Main content area */}
            <Box flex={1} pos="relative" mih={0} style={{overflow: "hidden"}}>
                {/* New chat hero overlay */}
                <Stack
                    pos="absolute"
                    inset={0}
                    justify="flex-end"
                    align="center"
                    pb={24}
                    gap={0}
                    opacity={isNewChat ? 1 : 0}
                    style={{
                        transition: "opacity 300ms ease",
                        pointerEvents: isNewChat ? "auto" : "none",
                    }}
                >
                    <div style={{display: "grid", placeItems: "center"}}>
                        <Stack
                            align="center"
                            gap={6}
                            style={{
                                gridArea: "1 / 1",
                                opacity: !temporary ? 1 : 0,
                                transition: "opacity 300ms ease",
                            }}
                        >
                            <ThemeIcon variant="light" size={48} radius="xl">
                                <IconMessageCirclePlus size={26}/>
                            </ThemeIcon>
                            <Text size="xl" fw={600} mt={4}>New Chat</Text>
                        </Stack>
                        <Stack
                            align="center"
                            gap={6}
                            style={{
                                gridArea: "1 / 1",
                                opacity: temporary ? 1 : 0,
                                transition: "opacity 300ms ease",
                            }}
                        >
                            <ThemeIcon variant="light" color="gray" size={48} radius="xl">
                                <IconEyeOff size={26}/>
                            </ThemeIcon>
                            <Text size="xl" fw={600} mt={4}>New Temporary Chat</Text>
                        </Stack>
                    </div>
                    <Text size="sm" c="dimmed" mt={6}>What's on your mind?</Text>
                </Stack>

                {/* Messages scroll area */}
                {!isNewChat && (
                    <ScrollArea
                        viewportRef={messagesViewportRef}
                        onScrollPositionChange={handleScroll}
                        h="100%"
                        style={{maskImage: `linear-gradient(to bottom, transparent 0%, black 25px, black calc(100% - 25px), transparent 100%)`}}
                        styles={{
                            scrollbar: {
                                zIndex: "calc(var(--mantine-z-index-app) + 1)",
                            },
                        }}
                    >
                        {isMobile && (
                            <Box
                                style={{
                                    position: "sticky",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 50,
                                    zIndex: "var(--mantine-z-index-app)",
                                    backgroundColor: "color-mix(in srgb, var(--mantine-color-body), transparent 15%)",
                                    backdropFilter: "blur(5px)",
                                    borderBottom: "1px solid var(--mantine-color-dark-5)",
                                }}
                            />
                        )}
                        <Stack pt={10} px={20} m="0 auto" maw={860} gap={10}>
                            {!isInitializing &&
                                messages.map((message) => (
                                    <Message
                                        key={message.id}
                                        message={message}
                                        opacity={getMessageOpacity(message)}
                                    />
                                ))}
                        </Stack>
                    </ScrollArea>
                )}

                {/* InputEffects overlay — sits at the bottom of the scroll area */}
                <Group
                    pos="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    justify="center"
                    p={isInputMaxWidth ? 0 : "0 10px"}
                    style={{
                        pointerEvents: "none",
                    }}
                >
                    <div style={{width: "100%", maxWidth: inputMaxWidth}}>
                        <Group gap={3} pb={3}>
                            {editing && (
                                <InputEffect
                                    content={
                                        <>
                                            Editing{" "}
                                            <span style={{color: "#aaa"}}>
                                                {scrubText(extractText(editing.data), 20)}
                                            </span>
                                        </>
                                    }
                                    onDelete={() => setEditing(null)}
                                />
                            )}
                            {truncating && (
                                <InputEffect
                                    content={"Overwriting newer"}
                                    onDelete={() => setTruncating(false)}
                                />
                            )}
                            {insertingAfter && (
                                <InputEffect
                                    content={
                                        <>
                                            Inserting after{" "}
                                            <span style={{color: "#aaa"}}>
                                                {scrubText(extractText(insertingAfter.data), 20)}
                                            </span>
                                        </>
                                    }
                                    onDelete={() => setInsertingAfter(null)}
                                />
                            )}
                            {files.map(file => (
                                <InputEffect
                                    content={<Attachments
                                        list={[{name: file.name, mime: file.type, url: URL.createObjectURL(file)}]}/>}
                                    onDelete={() => removeFile(file)}
                                    key={file.name}
                                />
                            ))}
                        </Group>
                    </div>
                </Group>
            </Box>

            {/* Input area */}
            <Box
                w="100%"
                maw={inputMaxWidth}
                m={`0 auto ${!isNewChat && isInputMaxWidth ? 20 : 0} auto`}
                p={isInputMaxWidth ? 0 : "0 10px 10px 10px"}
                ref={inputRef}
            >
                <Input style={{boxShadow: shadow, borderRadius: 10}}/>
            </Box>

            {/* Bottom spacer for vertical centering in new chat mode */}
            <div
                style={{ // TODO - isMessaging makes iOS look better, but how does it work on Android?
                    flexGrow: isNewChat && !(isMobile && isMessaging) ? 1 : 0,
                    flexShrink: 0,
                    flexBasis: isNewChat && !(isMobile && isMessaging) ? 60 : 0,
                    transition: hasBeenNewChat.current
                        ? "flex-grow 400ms ease, flex-basis 400ms ease"
                        : "none",
                }}
            />
        </Stack>
    );
}