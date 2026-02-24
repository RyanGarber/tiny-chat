import {Box, Button, Divider, Group, Loader, Popover, ScrollAreaAutosize, Skeleton, Stack, Text,} from "@mantine/core";
import {useElementSize} from "@mantine/hooks";
import {MessageOmitted} from "@tiny-chat/core-backend/types";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {extractThoughts} from "@/utils.ts";
import MessageBodyContent from "@/components/MessageBodyContent.tsx";
import Markdown from "@/components/Markdown.tsx";
import {useLayout} from "@/managers/layout.tsx";
import {IconArrowForwardUp, IconPaperclip,} from "@tabler/icons-react";
import {useChats} from "@/managers/chats.tsx";
import Attachments from "@/components/Attachments.tsx";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";

export default function MessageBody({message}: { message: MessageOmitted }) {
    const {shadow} = useLayout();
    const {messages} = useChats();
    if (message.author === Author.USER) {
        const config = messages[messages.findIndex(m => m.id === message.id) + 1]?.config;
        const files = message.data.filter(p => p.type === "file");
        return <Stack gap={5}>
            {config && <Group gap={5} c="dimmed">
                <IconArrowForwardUp size={14}/>
                <Text size="xs">{config.model}</Text>
            </Group>}

            <Box
                px={20}
                py={10}
                bdrs="sm"
                maw="100%"
                className="user-message"
                style={{boxShadow: shadow}}
            >
                <MessageBodyContent message={message}/>
            </Box>
            {files.length !== 0 &&
                <Group gap={0} c="dimmed">
                    <IconPaperclip size={14}/>
                    <Attachments list={files.map(f => ({name: f.name, mime: f.mime, url: f.url}))}/>
                </Group>
            }
        </Stack>;
    } // no thinking or generating for user messages

    const {ref: containerRef, width: containerWidth} = useElementSize();
    const {ref: thinkingButtonRef, width: thinkingButtonWidth} =
        useElementSize();
    const [maxHeight, setMaxHeight] = useState(400);
    const [popoverPosition, setPopoverPosition] = useState<
        "bottom-end" | "top-end"
    >("bottom-end");

    const thoughts = extractThoughts(message.data);

    const [isThinkingOpen, setThinkingOpen] = useState(false);
    useEffect(() => {
        setThinkingOpen(message.state.thinking || false);
    }, [message.state.thinking]); // state.anything, state.generating

    useEffect(() => {
        const updatePosition = () => {
            if (thinkingButtonRef.current) {
                const rect = thinkingButtonRef.current.getBoundingClientRect();
                const isInBottomHalf = rect.top > window.innerHeight / 2;
                setPopoverPosition(isInBottomHalf ? "top-end" : "bottom-end");
            }
        };
        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [isThinkingOpen]);

    const thinkingRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (message.state.thinking && isThinkingOpen && thinkingRef.current) {
            thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
        }
    });
    useLayoutEffect(() => {
        if (!message.state.thinking && thinkingRef.current) {
            thinkingRef.current.scrollTo({top: 0, behavior: 'smooth'});
        }
    });

    return (
        <Box
            w="100%"
            ref={containerRef}
            style={
                message.state.any && !message.state.generating
                    ? {display: "flex", gap: 10, justifyContent: "center"}
                    : {}
            }
        >
            {thoughts.length > 0 && (
                <>
                    <Popover
                        position={popoverPosition}
                        withArrow
                        arrowSize={15}
                        shadow="md"
                        offset={{mainAxis: 15, crossAxis: -10}}
                        arrowOffset={thinkingButtonWidth / 2}
                        width={containerWidth + 20}
                        opened={isThinkingOpen}
                        onChange={setThinkingOpen}
                        middlewares={{
                            shift: true,
                            flip: true,
                            size: {
                                apply({availableHeight, elements}) {
                                    const button = elements.reference as HTMLElement;
                                    const rect = button.getBoundingClientRect();
                                    const spaceAbove = rect.top;
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const maxSpace = Math.max(spaceAbove, spaceBelow);
                                    setMaxHeight(Math.min(availableHeight, maxSpace) - 130);
                                },
                            },
                        }}
                    >
                        <Popover.Target>
                            <Button
                                variant={isThinkingOpen ? "gradient" : "subtle"}
                                size="xs"
                                mb={10}
                                ref={thinkingButtonRef}
                                onClick={() => setThinkingOpen(!isThinkingOpen)}
                            >
                                {message.state.thinking
                                    ? "Thinking..."
                                    : isThinkingOpen
                                        ? "Hide Thinking"
                                        : "Show Thinking"}
                            </Button>
                        </Popover.Target>
                        <Popover.Dropdown>
                            <ScrollAreaAutosize mah={maxHeight} viewportRef={thinkingRef}>
                                <Stack>
                                    {thoughts.map((thought, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                padding: "10px 0 10px 20px",
                                                borderLeft: "2px solid #555",
                                            }}
                                        >
                                            <Markdown source={thought}/>
                                        </div>
                                    ))}
                                </Stack>
                            </ScrollAreaAutosize>
                        </Popover.Dropdown>
                    </Popover>
                </>
            )}
            {!message.state.any || message.state.generating ? (
                <>
                    <MessageBodyContent message={message}/>
                    {message.state.generating && (
                        <Loader
                            size="sm"
                            type="dots"
                            style={{margin: "0 auto"}}
                            color="#ccc"
                        />
                    )}
                </>
            ) : (
                <div style={{flex: 1}}>
                    <Skeleton height={10} radius="md"/>
                    <Skeleton height={10} width="70%" mt={10} mb={20} radius="md"/>
                </div>
            )}
            {message.data.some(p => p.type === "abort") && (
                <Divider label="Stopped" size="md" styles={{label: {fontSize: 14}}}/>
            )}
        </Box>
    );
}
