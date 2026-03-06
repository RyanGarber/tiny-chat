import {useMessaging} from "@/managers/messaging.tsx";
import {ActionIcon, Blockquote, Box, Group, Text as MantineText} from "@mantine/core";
import {IconQuoteFilled, IconX} from "@tabler/icons-react";
import {BaseText, Node, Range, Text, Transforms} from "slate";
import {ReactEditor, RenderElementProps} from "slate-react";
import {tokenize} from "@/slate/tokenizer.tsx";

export function renderElement(props: RenderElementProps) {
    const editor = useMessaging.getState().editor!;

    switch (props.element.type) {
        case "quote": {
            const modelName = (props.element as any).model as string | undefined;
            return (
                <Blockquote
                    contentEditable={false}
                    p={10}
                    mx={0}
                    my={10}
                    fz="1em"
                    style={{
                        userSelect: "none",
                        cursor: "default",
                    }}
                >
                    {modelName && (
                        <Group gap={5} c="dimmed" mb={4}>
                            <IconQuoteFilled size={14} style={{transform: "scale(-1,1)"}}/>
                            <MantineText size="xs">{modelName}</MantineText>
                        </Group>
                    )}
                    <div style={{display: "flex"}}>
                        <ActionIcon
                            size={24}
                            variant="subtle"
                            onClick={() => {
                                const path = ReactEditor.findPath(editor, props.element);
                                Transforms.removeNodes(editor, {at: path});
                            }}
                        >
                            <IconX size={18}/>
                        </ActionIcon>
                        <Box pl={5}>{(props.element.children[0] as BaseText).text}</Box>
                    </div>
                </Blockquote>
            );
        }
        default:
            return (
                <p
                    {...props.attributes}
                    style={{
                        ...(props.element.hidden && {
                            height: 1,
                        }),
                    }}
                >
                    {props.children}
                </p>
            );
    }
}

export function renderLeaf(props: any) {
    let {attributes, children, leaf} = props;

    if (leaf.bold) {
        children = <strong>{children}</strong>;
    }

    if (leaf.italic) {
        children = <em>{children}</em>;
    }

    if (leaf.code) {
        children = <code>{children}</code>;
    }

    if (leaf.strikethrough) {
        children = <s>{children}</s>;
    }

    if (leaf.heading) {
        const sizes: Record<number, string> = {1: "2em", 2: "1.5em", 3: "1.25em", 4: "1em", 5: "0.875em", 6: "0.75em"};
        children = <span
            style={{fontSize: sizes[leaf.heading] ?? "1em", fontWeight: "bold", lineHeight: 1.2}}>{children}</span>;
    }

    if (leaf.link) {
        children = <span style={{color: "var(--mantine-color-blue-5)", textDecoration: "underline"}}>{children}</span>;
    }

    if (leaf.syntax) {
        return (
            <span {...attributes} style={{opacity: 2 / 3}}>
                {children}
            </span>
        );
    }

    return <span {...attributes}>{children}</span>;
}

export function decorate([node, path]: [Node, number[]]) {
    if (!Text.isText(node)) return [];

    const ranges: Range[] = [];
    const tokens = tokenize(node.text);

    for (const token of tokens) {
        switch (token.type) {
            case "bold":
            case "italic":
            case "code":
            case "strikethrough": {
                let mLen = 1;
                if (token.type === "bold" || token.type === "strikethrough") mLen = 2;
                ranges.push({
                    anchor: {path, offset: token.start},
                    focus: {path, offset: token.start + mLen},
                    [token.type]: true,
                    syntax: true
                });
                if (token.start + mLen < token.end - mLen)
                    ranges.push({
                        anchor: {path, offset: token.start + mLen},
                        focus: {path, offset: token.end - mLen},
                        [token.type]: true
                    });
                ranges.push({
                    anchor: {path, offset: token.end - mLen},
                    focus: {path, offset: token.end},
                    [token.type]: true,
                    syntax: true
                });
                break;
            }
            case "heading": {
                const markEnd = token.level + 1; // "## " → markEnd = 3
                // The "#…" and space: dimmed only, no heading size
                ranges.push({anchor: {path, offset: 0}, focus: {path, offset: markEnd}, syntax: true});
                // The rest of the line: heading-sized and bold
                if (markEnd < token.end)
                    ranges.push({
                        anchor: {path, offset: markEnd},
                        focus: {path, offset: token.end},
                        heading: token.level
                    });
                break;
            }
            case "link": {
                // "[" — dimmed
                ranges.push({
                    anchor: {path, offset: token.start},
                    focus: {path, offset: token.textStart},
                    syntax: true
                });
                // link text — blue + underline
                if (token.textStart < token.textEnd)
                    ranges.push({
                        anchor: {path, offset: token.textStart},
                        focus: {path, offset: token.textEnd},
                        link: true
                    });
                // "](" — dimmed
                ranges.push({
                    anchor: {path, offset: token.textEnd},
                    focus: {path, offset: token.urlStart},
                    syntax: true
                });
                // url — dimmed
                if (token.urlStart < token.urlEnd)
                    ranges.push({
                        anchor: {path, offset: token.urlStart},
                        focus: {path, offset: token.urlEnd},
                        syntax: true
                    });
                // ")" — dimmed
                ranges.push({anchor: {path, offset: token.urlEnd}, focus: {path, offset: token.end}, syntax: true});
                break;
            }
            case "listMarker": {
                // Just dim the bullet/number marker
                ranges.push({anchor: {path, offset: token.start}, focus: {path, offset: token.end}, syntax: true});
                break;
            }
            case "quoteMarker": {
                // Dim the entire line
                ranges.push({anchor: {path, offset: 0}, focus: {path, offset: token.end}, syntax: true});
                break;
            }
            case "codeMarker": {
                ranges.push({anchor: {path, offset: 0}, focus: {path, offset: token.end}, syntax: true});
                break;
            }
        }
    }

    return ranges;
}