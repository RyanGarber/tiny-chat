import {useMessaging} from "@/managers/messaging.tsx";
import {BaseElement, BaseText, Descendant, Text} from "slate";

const QUOTE_PREFIX = "::>:: ";

export function serializeElement(element: BaseElement): string | null {
    if ((element as BaseElement).hidden) return null;
    switch (element.type) {
        case "quote": {
            const model = (element as any).model as string | undefined;
            const modelTag = model ? `${QUOTE_PREFIX}::model=${model}::\n` : "";
            return (
                modelTag +
                (element.children[0] as BaseText).text
                    .split("\n")
                    .map((line) => `${QUOTE_PREFIX}${line}`)
                    .join("\n") + "\n"
            );
        }
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
    return useMessaging.getState().editor!.children
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

        let model = "";
        let contentLines = quoteLines;
        if (quoteLines[0].startsWith("::model=") && quoteLines[0].endsWith("::")) {
            model = quoteLines[0].slice("::model=".length, -2);
            contentLines = quoteLines.slice(1);
        }

        nodes.push({
            type: "quote",
            model,
            children: [{text: contentLines.join("\n")}],
        } as Descendant & { model: string });

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
