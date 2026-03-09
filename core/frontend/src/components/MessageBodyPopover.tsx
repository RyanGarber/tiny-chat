import {Button, FloatingPosition, Popover, ScrollAreaAutosize, Typography} from "@mantine/core";
import {ReactNode, useEffect, useLayoutEffect, useRef, useState} from "react";

export default function MessageBodyPopover({
                                               width,
                                               button,
                                               dropdown,
                                               defaultOpened,
                                               autoscroll,
                                           }: {
    width: number | string,
    button: ReactNode,
    dropdown: ReactNode,
    defaultOpened?: boolean,
    autoscroll?: boolean,
}) {
    const [opened, setOpened] = useState(defaultOpened);

    const [maxHeight, setMaxHeight] = useState(400);
    const [position, setPosition] = useState<FloatingPosition>("bottom");

    const buttonRef = useRef<HTMLButtonElement>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        setOpened(defaultOpened ?? false);
    }, [defaultOpened]);

    useLayoutEffect(() => {
        if (defaultOpened && opened && scrollRef.current && autoscroll) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [dropdown, defaultOpened, opened]); // TODO - will dropdown be causing scrolls without content changes?

    useLayoutEffect(() => {
        if (!defaultOpened && scrollRef.current) {
            scrollRef.current.scrollTo({top: 0, behavior: "smooth"});
        }
    }, [defaultOpened]);

    useEffect(() => {
        const updatePosition = () => {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();
            const isInBottomHalf = rect.top > window.innerHeight / 2;
            //const spaceLeft = rect.left;
            //const spaceRight = window.innerWidth - rect.right;
            //const prefersStart = spaceRight >= spaceLeft;
            if (isInBottomHalf) {
                setPosition("top");
            } else {
                setPosition("bottom");
            }
        };

        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [opened]);

    return (
        <Popover
            position={position}
            withArrow
            arrowSize={15}
            arrowPosition="center"
            arrowOffset={15}
            withOverlay
            shadow="md"
            offset={{mainAxis: 15}}
            width={width}
            withinPortal={false}
            transitionProps={{duration: 0}}
            opened={opened}
            onChange={setOpened}
            middlewares={{
                shift: {padding: 10},
                flip: true,
                size: {
                    apply({availableHeight, elements}) {
                        const button = elements.reference as HTMLElement;
                        const rect = button.getBoundingClientRect();
                        const spaceAbove = rect.top;
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const maxSpace = Math.max(spaceAbove, spaceBelow);
                        setMaxHeight(Math.max(0, Math.min(availableHeight, maxSpace) - 130));
                        elements.floating.style.maxWidth = `${Math.max(0, window.innerWidth - 24)}px`;
                    },
                },
            }}
        >
            <Popover.Target>
                <Button
                    variant={opened ? "filled" : "subtle"}
                    size="xs"
                    ref={buttonRef}
                    onClick={() => setOpened(!opened)}
                    my={10}
                >
                    {button}
                </Button>
            </Popover.Target>
            <Popover.Dropdown>
                <ScrollAreaAutosize mah={maxHeight} viewportRef={scrollRef}>
                    <Typography style={{overflowWrap: "break-word"}}>
                        {dropdown}
                    </Typography>
                </ScrollAreaAutosize>
            </Popover.Dropdown>
        </Popover>
    );
}
