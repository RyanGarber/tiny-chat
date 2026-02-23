import {useMessaging} from "@/managers/messaging.tsx";
import {BaseElement, BaseText, Descendant, Text} from "slate";

const QUOTE_PREFIX = "::>:: ";

export function serializeElement(element: BaseElement): string | null {
    if ((element as BaseElement).hidden) return null;
    switch (element.type) {
        case "quote":
            return (
                (element.children[0] as BaseText).text
                    .split("\n")
                    .map((line) => `${QUOTE_PREFIX}${line}`)
                    .join("\n") + "\n"
            );
        default:
            return element.children
                .map((child) => {
                    if (Text.isText(child)) return (child as BaseText).text;
                    else return serializeElement(child as BaseElement);
                })
                .join("");
    }
}

export function serialize(): string {
    const {editor} = useMessaging.getState();
    if (!editor) console.log("No editor state available for serialization")
    if (!editor) return "";
    return editor.children
        .map((node) => serializeElement(node as BaseElement))
        .filter((line) => line !== null)
        .join("\n");
}

export function deserialize(md: string): Descendant[] {
    const lines = md.split("\n");
    const nodes: Descendant[] = [];

    let quoteLines: string[] = [];

    const endQuote = (line?: string) => {
        if (!quoteLines.length) return false;

        nodes.push({
            type: "quote",
            children: [{text: quoteLines.join("\n")}],
        });

        quoteLines = [];
        return !line?.trim().length;
    };

    for (const line of lines) {
        if (line.startsWith(QUOTE_PREFIX)) {
            quoteLines.push(line.slice(QUOTE_PREFIX.length));
            continue;
        }

        if (endQuote(line)) continue;

        nodes.push({
            type: "paragraph",
            children: [{text: line}],
        });
    }

    endQuote();
    console.log("Deserialized content:", nodes);

    return nodes;
}
