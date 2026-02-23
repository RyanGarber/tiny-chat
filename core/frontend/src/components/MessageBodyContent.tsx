import {useLayout} from "@/managers/layout.tsx";
import {useMessaging} from "@/managers/messaging.tsx";
import {ActionIcon, Box, Portal, Transition,} from "@mantine/core";
import {useTextSelection} from "@mantine/hooks";
import {IconQuoteFilled} from "@tabler/icons-react";
import {CSSProperties, useRef} from "react";
import {applyHljsTheme, extractText,} from "@/utils.ts";
import {MessageOmitted} from "@tiny-chat/core-backend/types.ts";
import {useSettings} from "@/managers/settings.tsx";
import Markdown from "@/components/Markdown.tsx";
import {Author} from "@tiny-chat/core-backend/generated/prisma/enums.ts";


export default function MessageBodyContent({message, style}: {
    message: MessageOmitted;
    style?: CSSProperties;
}) {
    const source = extractText(message.data); // TODO

    const {shadow} = useLayout();
    const {addQuote} = useMessaging();
    const {getCodeTheme} = useSettings();
    void applyHljsTheme(getCodeTheme());

    const container = useRef<HTMLDivElement>(null);

    if (message.author === Author.USER) return <Markdown source={source} style={style}/>; // no quoting user messages

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
            <Box ref={container}><Markdown source={source} style={style}/></Box>
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
