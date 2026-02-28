import {useLayout} from "@/managers/layout.tsx";
import {useMessaging} from "@/managers/messaging.tsx";
import {ActionIcon, Box, Image, Portal, Transition,} from "@mantine/core";
import {useTextSelection} from "@mantine/hooks";
import {IconQuoteFilled} from "@tabler/icons-react";
import React, {CSSProperties, useEffect, useLayoutEffect, useRef, useState} from "react";
import {applyHljsTheme, extractText,} from "@/utils.ts";
import {MessageOmitted} from "@tiny-chat/core-backend/types.ts";
import {useSettings} from "@/managers/settings.tsx";
import Markdown from "@/components/Markdown.tsx";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";

function useStreamedLength(fullLength: number, isGenerating: boolean): number {
    const [displayedLength, setDisplayedLength] = useState(fullLength);

    const fullLengthRef = useRef(fullLength);
    const displayedLengthRef = useRef(fullLength);
    const frameRef = useRef<number | null>(null);
    const isGeneratingRef = useRef(isGenerating);
    const tickRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        fullLengthRef.current = fullLength;
        if (isGeneratingRef.current && frameRef.current === null && tickRef.current) {
            frameRef.current = requestAnimationFrame(tickRef.current);
        }
    }, [fullLength]);

    useEffect(() => {
        isGeneratingRef.current = isGenerating;

        if (!isGenerating) {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
            setDisplayedLength(fullLengthRef.current);
            displayedLengthRef.current = fullLengthRef.current;
            tickRef.current = null;
            return;
        }

        const CHARS_PER_FRAME = 2;
        const CATCHUP_THRESHOLD = 30;

        const tick = () => {
            const pending = fullLengthRef.current - displayedLengthRef.current;
            if (pending > 0) {
                const charsToAdd = pending > CATCHUP_THRESHOLD
                    ? Math.ceil(pending / 2)
                    : Math.min(CHARS_PER_FRAME, pending);
                displayedLengthRef.current = Math.min(
                    displayedLengthRef.current + charsToAdd,
                    fullLengthRef.current,
                );
                setDisplayedLength(displayedLengthRef.current);
                frameRef.current = requestAnimationFrame(tick);
            } else {
                frameRef.current = null; // pause until new text arrives
            }
        };

        tickRef.current = tick;
        frameRef.current = requestAnimationFrame(tick);

        return () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
    }, [isGenerating]);

    return isGenerating ? displayedLength : fullLength;
}

export default function MessageBodyContent({message, style}: {
    message: MessageOmitted;
    style?: CSSProperties;
}) {
    const isGenerating = message.state.generating;

    // Build ordered segments (text blocks + inline images)
    const fullTextLength = message.data
        .filter(p => p.type === "text")
        .reduce((acc, s) => acc + s.value.length, 0);

    const streamedLength = useStreamedLength(fullTextLength, isGenerating);

    const {shadow} = useLayout();
    const {addQuote} = useMessaging();
    const {getCodeTheme} = useSettings();
    void applyHljsTheme(getCodeTheme());

    const container = useRef<HTMLDivElement>(null);
    const scrollElRef = useRef<HTMLElement | null>(null);
    const shouldFollowRef = useRef(true);

    // Capture the "was the user at the bottom?" state BEFORE mutation
    if (isGenerating && container.current) {
        let el: HTMLElement | null = container.current.parentElement;
        while (el) {
            if (el.scrollHeight > el.clientHeight + 1) {
                scrollElRef.current = el;
                shouldFollowRef.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                break;
            }
            el = el.parentElement;
        }
    }

    // After DOM mutations are applied, scroll to bottom if we were there before.
    useLayoutEffect(() => {
        if (!isGenerating) {
            shouldFollowRef.current = true; // reset for next stream
            return;
        }
        if (shouldFollowRef.current && scrollElRef.current) {
            scrollElRef.current.scrollTop = scrollElRef.current.scrollHeight;
        }
    }, [streamedLength, isGenerating]);

    if (message.author === Author.USER) return <Markdown source={extractText(message.data)} style={style}/>;

    const selection = useTextSelection();

    const isNodeInContainer = (node: Node | null): boolean => {
        if (!node || !container.current) return false;
        let current: Node | null = node;
        while (current) {
            if (current === container.current) return true;
            current = current.parentNode;
        }
        return false;
    };

    const isSelected =
        selection &&
        !selection.isCollapsed &&
        selection.rangeCount > 0 &&
        isNodeInContainer(selection.anchorNode) &&
        isNodeInContainer(selection.focusNode);

    let rect = {top: 0, left: 0, width: 0, height: 0};
    if (isSelected) rect = selection.getRangeAt(0).getBoundingClientRect();

    // Render parts
    let textOffset = 0;
    const renderedParts: React.ReactNode[] = [];
    for (let i = 0; i < message.data.length; i++) {
        const part = message.data[i];
        if (part.type === "text") {
            if (streamedLength <= textOffset) break;
            const visibleText = part.value.slice(0, streamedLength - textOffset);
            renderedParts.push(<Markdown key={i} source={visibleText} style={style}/>);
            textOffset += part.value.length;
            if (streamedLength < textOffset) break; // still streaming this segment
        } else if (part.type === "file" && part.mime?.startsWith("image/") && part.inline) {
            // Show the image as soon as all text before it has been revealed
            if (streamedLength >= textOffset) {
                renderedParts.push(
                    <Image key={i} src={part.url} alt={part.name} radius="md" maw="100%" w="auto" my={4}/>
                );
            } else {
                break;
            }
        }
    }

    return (
        <>
            <Box ref={container} className={isGenerating ? "is-streaming" : ""}>
                {renderedParts}
                {/* Standalone cursor shown before the first characters arrive */}
                {isGenerating && renderedParts.length === 0 && <span className="streaming-cursor-standalone">▋</span>}
            </Box>
            <Portal target={document.body}>
                <Transition
                    mounted={isSelected ?? false}
                    transition="fade"
                    duration={100}
                    timingFunction="ease"
                >
                    {(styles) => (
                        <ActionIcon
                            variant="gradient"
                            size={26}
                            radius="xl"
                            style={{
                                position: "fixed",
                                top: rect.top - 30,
                                left: rect.left + rect.width / 2,
                                transform: "translateX(-50%)",
                                zIndex: "var(--mantine-zindex-app)",
                                boxShadow: shadow,
                                ...styles,
                            }}
                            onClick={() => selection && addQuote(selection.toString())}
                        >
                            <IconQuoteFilled size={18}/>
                        </ActionIcon>
                    )}
                </Transition>
            </Portal>
        </>
    );
}