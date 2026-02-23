import {useMessaging} from "@/managers/messaging.tsx";
import {setupEditor} from "@/slate/setup.tsx";
import {onKeyDown, onSend} from "@/slate/events.tsx";
import {decorate, renderElement, renderLeaf} from "@/slate/renderer.tsx";
import {
    ActionIcon,
    Box,
    Button,
    Divider,
    FileButton,
    InputBase,
    InputWrapper,
    InputWrapperProps,
    Menu,
    Popover,
    PopoverDropdown,
    PopoverTarget,
    ScrollAreaAutosize,
    Select,
    Slider,
    Stack,
    Text,
} from "@mantine/core";
import {IconFile, IconPlus, IconSend,} from "@tabler/icons-react";
import {useCallback, useLayoutEffect, useRef, useState,} from "react";
import {Editable, ReactEditor, Slate} from "slate-react";
import {serialize} from "@/slate/serializer.tsx";
import {useServices} from "@/managers/services.tsx";
import {useLayout} from "@/managers/layout.tsx";
import {useLocalStorage} from "@mantine/hooks";
import {useSettings} from "@/managers/settings.tsx";
import {DropzoneFullScreen} from "@mantine/dropzone";
import {zConfig} from "@tiny-chat/core-backend/types.ts";
import {consumeLabel} from "@/utils.ts";

export default function Input({...props}: InputWrapperProps) {
    const {setEditor, config, setConfig, addFiles} = useMessaging();
    const {services, findService} = useServices();
    const {shadow, isMessagingDisabled} = useLayout();
    const {getTheme} = useSettings();

    const [isMultiline, setMultiline] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const leftSectionRef = useRef<HTMLDivElement>(null);
    const rightSectionRef = useRef<HTMLDivElement>(null);

    const [editor] = useState(() => setupEditor());
    useLayoutEffect(() => setEditor(editor), []);

    useLayoutEffect(() => {
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            const height = entry.contentRect.height;
            if (height > 40) setMultiline(true);
        });
        if (scrollRef.current) {
            observer.observe(scrollRef.current);
        }
        return () => observer.disconnect();
    }, [scrollRef.current]);

    const [sectionWidths, setSectionWidths] = useState({left: 42, right: 42});
    useLayoutEffect(() => {
        const updateWidths = () => {
            const leftWidth = leftSectionRef.current?.offsetWidth ?? 42;
            const rightWidth = rightSectionRef.current?.offsetWidth ?? 42;
            setSectionWidths({left: leftWidth, right: rightWidth});
        };

        updateWidths();
        const observer = new ResizeObserver(updateWidths);

        if (leftSectionRef.current) observer.observe(leftSectionRef.current);
        if (rightSectionRef.current) observer.observe(rightSectionRef.current);

        return () => observer.disconnect();
    }, []);

    const [_, onChangedConfig] = useLocalStorage<string>({key: "config"});

    const args = findService(config?.service ?? "")?.getArgs(config!.model) ?? null;
    const setArg = (name: string, value: any) => {
        if (!config) return config;
        config.args = {...config.args, [name]: value};
        setConfig(config);
        onChangedConfig(JSON.stringify(config));
    };

    const leftActionContent = (
        <Menu
            position="top-start"
            offset={5}
            transitionProps={{transition: "fade-up"}}
        >
            <Menu.Target>
                <ActionIcon
                    variant="subtle"
                    size={32}
                    disabled={isMessagingDisabled}
                >
                    <IconPlus size={24}/> {/* ALL TODO */}
                    <DropzoneFullScreen
                        onDrop={(files) => addFiles(...files)}/> {/* TODO - not working */}
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown style={{boxShadow: shadow}}>
                <FileButton onChange={(files) => addFiles(...files)}
                            accept="image/jpeg,image/png,image/webp,image/gif" multiple>
                    {(props) => (
                        <Menu.Item {...props} leftSection={<IconFile size={16}/>}
                                   closeMenuOnClick={false}>
                            Add File
                        </Menu.Item>
                    )}
                </FileButton>
            </Menu.Dropdown>
        </Menu>
    );

    const rightActionContent = (
        <>
            <Popover position="top" transitionProps={{transition: "fade-up"}} offset={0}>
                <PopoverTarget>
                    <Button fw="normal"
                            bg={getTheme() === "dark" ? "var(--mantine-color-dark-5)" : "var(--mantine-color-gray-1)"}
                            c="var(--mantine-color-text)"
                            maw="25vw">{config?.model}</Button>
                </PopoverTarget>
                <PopoverDropdown maw={250}>
                    <Select
                        variant="filled"
                        searchable
                        required
                        maxDropdownHeight={250}
                        allowDeselect={false}
                        comboboxProps={{
                            withinPortal: false,
                            transitionProps: {transition: "fade-up"},
                            offset: 0,
                        }}
                        styles={{
                            dropdown: {
                                boxShadow: shadow,
                            },
                        }}
                        data={services.map((s) => ({
                            group: s.name,
                            items: s.models.sort().map((m) => ({
                                label: m,
                                value: JSON.stringify({service: s.name, model: m}),
                            })),
                        }))}
                        value={JSON.stringify({service: config?.service, model: config?.model})}
                        onChange={(value) => {
                            const parsed = JSON.parse(value!);
                            const config = zConfig.parse({
                                service: parsed.service,
                                model: parsed.model
                            });
                            setConfig(config);
                            onChangedConfig(JSON.stringify(config));
                        }}
                    />
                    {!!args?.length && <Divider my="xs"/>}
                    <Stack gap="xs">
                        {args?.map((arg) => (
                            <Box key={arg.name}>
                                {arg.type === "list" && (
                                    <Select key={arg.name} label={arg.name} styles={consumeLabel}
                                            comboboxProps={{withinPortal: false, offset: 0}}
                                            data={arg.values}
                                            value={config?.args?.[arg.name] ?? arg.default}
                                            onChange={value => setArg(arg.name, value)}/>
                                )}
                                {arg.type === "range" && (
                                    <>
                                        <Text size="xs">{arg.name}</Text>
                                        <Slider min={arg.min} max={arg.max}
                                                step={arg.step}
                                                value={config?.args?.[arg.name] ?? arg.default}
                                                onChange={value => setArg(arg.name, value)}/>
                                    </>
                                )}
                            </Box>
                        ))}
                    </Stack>
                </PopoverDropdown>
            </Popover>
            <ActionIcon
                variant="subtle"
                size={32}
                onClick={onSend}
                disabled={isMessagingDisabled}
            >
                <IconSend size={24}/>
            </ActionIcon>
        </>
    );

    // Side-section wrappers: always in the DOM (for ref-based width measurement),
    // fade out when multiline so they don't overlap the content.
    const leftActions = (
        <div
            ref={leftSectionRef}
            style={{
                display: "flex",
                alignItems: "center",
                opacity: isMultiline ? 0 : 1,
                pointerEvents: isMultiline ? "none" : "auto",
                transition: "opacity 200ms ease",
            }}
        >
            {leftActionContent}
        </div>
    );

    const rightActions = (
        <div
            ref={rightSectionRef}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                opacity: isMultiline ? 0 : 1,
                pointerEvents: isMultiline ? "none" : "auto",
                transition: "opacity 200ms ease",
            }}
        >
            {rightActionContent}
        </div>
    );

    return (
        <>
            <InputWrapper {...props}>
                <InputBase
                    component="div"
                    multiline
                    pointer
                    disabled={isMessagingDisabled}
                    leftSection={leftActions}
                    rightSection={rightActions}
                    style={{
                        "--input-left-section-width": "auto",
                        "--input-right-section-width": "auto",
                    }}
                    styles={{
                        input: {
                            padding: 0,
                            display: "flex",
                            flexDirection: "column",
                            wordBreak: "break-word",
                        },
                        section: {
                            display: "flex",
                            alignItems: "center",
                            margin: "5px",
                        },
                    }}
                >
                    <ScrollAreaAutosize
                        ref={scrollRef}
                        type="auto"
                        mah={200}
                        scrollbarSize={6}
                        style={{
                            paddingLeft: (!isMultiline ? sectionWidths.left : 0) + 10,
                            paddingRight: (!isMultiline ? sectionWidths.right : 0) + 10,
                            paddingTop: 5,
                            paddingBottom: 5,
                            cursor: isMessagingDisabled ? "not-allowed" : "text",
                            transition: "padding-left 200ms ease, padding-right 200ms ease",
                        }}
                        onClick={() => ReactEditor.focus(editor)}
                    >
                        <Slate
                            editor={editor!}
                            initialValue={[{type: "paragraph", children: [{text: ""}]}]}
                            onValueChange={() => {
                                if (!serialize().length) setMultiline(false);
                            }}
                        >
                            <Editable
                                style={{minHeight: 30}}
                                renderElement={useCallback(renderElement, [])}
                                renderLeaf={useCallback(renderLeaf, [])}
                                decorate={useCallback(decorate, [])}
                                onKeyDown={onKeyDown}
                                readOnly={isMessagingDisabled}
                            ></Editable>
                        </Slate>
                    </ScrollAreaAutosize>
                    <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0 5px 5px 5px",
                        maxHeight: isMultiline ? 50 : 0,
                        opacity: isMultiline ? 1 : 0,
                        overflow: "hidden",
                        pointerEvents: isMultiline ? "auto" : "none",
                        transition: "max-height 200ms ease, opacity 200ms ease",
                    }}>
                        <div style={{display: "flex", alignItems: "center"}}>{leftActionContent}</div>
                        <div style={{display: "flex", alignItems: "center", gap: "5px"}}>{rightActionContent}</div>
                    </div>
                </InputBase>
            </InputWrapper>
        </>
    );
}
