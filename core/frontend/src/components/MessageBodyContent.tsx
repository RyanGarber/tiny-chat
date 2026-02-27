import {useLayout} from "@/managers/layout.tsx";
import {useMessaging} from "@/managers/messaging.tsx";
import {ActionIcon, Box, Portal, Transition,} from "@mantine/core";
import {useTextSelection} from "@mantine/hooks";
import {IconQuoteFilled} from "@tabler/icons-react";
import {CSSProperties, useEffect, useLayoutEffect, useRef, useState} from "react";
import {applyHljsTheme, extractText,} from "@/utils.ts";
import {MessageOmitted} from "@tiny-chat/core-backend/types.ts";
import {useSettings} from "@/managers/settings.tsx";
import Markdown from "@/components/Markdown.tsx";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";

function useStreamedText(fullText: string, isGenerating: boolean): string {
    const [displayedLength, setDisplayedLength] = useState(fullText.length);

    const fullTextRef = useRef(fullText);
    const displayedLengthRef = useRef(fullText.length);
    const frameRef = useRef<number | null>(null);
    const isGeneratingRef = useRef(isGenerating);
    const tickRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        fullTextRef.current = fullText;
        if (isGeneratingRef.current && frameRef.current === null && tickRef.current) {
            frameRef.current = requestAnimationFrame(tickRef.current);
        }
    }, [fullText]);

    useEffect(() => {
        isGeneratingRef.current = isGenerating;

        if (!isGenerating) {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
            setDisplayedLength(fullTextRef.current.length);
            displayedLengthRef.current = fullTextRef.current.length;
            tickRef.current = null;
            return;
        }

        const CHARS_PER_FRAME = 2;
        const CATCHUP_THRESHOLD = 30;

        const tick = () => {
            const pending = fullTextRef.current.length - displayedLengthRef.current;
            if (pending > 0) {
                const charsToAdd = pending > CATCHUP_THRESHOLD
                    ? Math.ceil(pending / 2)
                    : Math.min(CHARS_PER_FRAME, pending);
                displayedLengthRef.current = Math.min(
                    displayedLengthRef.current + charsToAdd,
                    fullTextRef.current.length,
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

    return isGenerating ? fullText.slice(0, displayedLength) : fullText;
}

export default function MessageBodyContent({message, style}: {
    message: MessageOmitted;
    style?: CSSProperties;
}) {
    const fullSource = extractText(message.data);
    const isGenerating = message.state.generating;

    const source = useStreamedText(fullSource, isGenerating);

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
    }, [source, isGenerating]);

    if (message.author === Author.USER) return <Markdown source={source} style={style}/>;

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

    return (
        <>
            <Box ref={container} className={isGenerating ? "is-streaming" : ""}>
                <Markdown source={source} style={style}/>
                {/* Standalone cursor shown before the first characters arrive */}
                {isGenerating && !source && <span className="streaming-cursor-standalone">▋</span>}
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
                            <IconQuoteFilled size={18}></IconQuoteFilled>
                        </ActionIcon>
                    )}
                </Transition>
            </Portal>
        </>
    );
}