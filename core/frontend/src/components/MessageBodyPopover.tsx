import {Popover, Typography} from "@mantine/core";
import {useElementSize, useMergedRef} from "@mantine/hooks";
import {ReactNode, useEffect, useRef, useState} from "react";

export default function MessageBodyPopover({
                                               width,
                                               renderTarget,
                                               renderDropdown,
                                               opened,
                                               onChange,
                                           }: {
    width: number | string,
    renderTarget: (props: { ref: (node: HTMLElement | null) => void }) => ReactNode,
    renderDropdown: (props: { maxHeight: number }) => ReactNode,
    opened?: boolean,
    onChange?: (opened: boolean) => void
}) {
    const {ref: elementSizeRef, width: targetWidth} = useElementSize<HTMLElement>();
    const targetElementRef = useRef<HTMLElement | null>(null);
    const [maxHeight, setMaxHeight] = useState(400);
    const [position, setPosition] = useState<"bottom-start" | "bottom-end" | "top-start" | "top-end">("bottom-start");

    const setTargetRef = useMergedRef(elementSizeRef, (node: HTMLElement | null) => {
        targetElementRef.current = node;
    });

    useEffect(() => {
        const updatePosition = () => {
            if (!targetElementRef.current) return;
            const rect = targetElementRef.current.getBoundingClientRect();
            const isInBottomHalf = rect.top > window.innerHeight / 2;
            const spaceLeft = rect.left;
            const spaceRight = window.innerWidth - rect.right;
            const prefersStart = spaceRight >= spaceLeft;
            if (isInBottomHalf) {
                setPosition(prefersStart ? "top-start" : "top-end");
            } else {
                setPosition(prefersStart ? "bottom-start" : "bottom-end");
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
            //withArrow - TODO - arrow doesn't position correctly
            arrowSize={15}
            shadow="md"
            offset={{mainAxis: 15}}
            arrowOffset={targetWidth / 2}
            width={width}
            opened={opened}
            onChange={onChange}
            zIndex="calc(var(--mantine-z-index-app) + 2)"
            withinPortal={false}
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
            <Popover.Target>{renderTarget({ref: setTargetRef})}</Popover.Target>
            <Popover.Dropdown>
                <Typography style={{overflowWrap: "break-word"}}>
                    {renderDropdown({maxHeight})}
                </Typography>
            </Popover.Dropdown>
        </Popover>
    );
}
