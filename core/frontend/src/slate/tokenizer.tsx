type Token =
    | { type: "bold"; start: number; end: number }
    | { type: "italic"; start: number; end: number }
    | { type: "code"; start: number; end: number }
    | { type: "strikethrough"; start: number; end: number }
    | { type: "heading"; level: number; start: number; end: number }
    | { type: "link"; start: number; end: number; textStart: number; textEnd: number; urlStart: number; urlEnd: number }
    | { type: "listMarker"; start: number; end: number }
    | { type: "quoteMarker"; start: number; end: number };

export function tokenize(md: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    // Block-level markers — only valid at the very start of the string
    const headingMatch = md.match(/^(#{1,6}) /);
    if (headingMatch) {
        const level = headingMatch[1].length;
        tokens.push({type: "heading", level, start: 0, end: md.length});
        i = level + 1; // skip past "## "
    } else {
        const listMatch = md.match(/^(-|\*|\+|\d+\.) /);
        if (listMatch) {
            tokens.push({type: "listMarker", start: 0, end: listMatch[0].length});
            i = listMatch[0].length;
        }
        const quoteMatch = md.match(/^> /);
        if (quoteMatch) {
            tokens.push({type: "quoteMarker", start: 0, end: md.length});
            i = quoteMatch[0].length;
        }
    }

    while (i < md.length) {
        if (md[i] === "`") {
            const end = md.indexOf("`", i + 1);
            if (end !== -1) {
                tokens.push({type: "code", start: i, end: end + 1});
                i = end + 1;
                continue;
            }
        }

        if (md.startsWith("**", i)) {
            const end = md.indexOf("**", i + 2);
            if (end !== -1) {
                tokens.push({type: "bold", start: i, end: end + 2});
                i = end + 2;
                continue;
            }
        }

        if (md[i] === "*" && md[i + 1] !== "*") {
            const end = md.indexOf("*", i + 1);
            if (end !== -1) {
                tokens.push({type: "italic", start: i, end: end + 1});
                i = end + 1;
                continue;
            }
        }

        if (md.startsWith("~~", i)) {
            const end = md.indexOf("~~", i + 2);
            if (end !== -1) {
                tokens.push({type: "strikethrough", start: i, end: end + 2});
                i = end + 2;
                continue;
            }
        }

        if (md[i] === "[") {
            const closeBracket = md.indexOf("]", i + 1);
            if (closeBracket !== -1 && md[closeBracket + 1] === "(") {
                const closeParen = md.indexOf(")", closeBracket + 2);
                if (closeParen !== -1) {
                    tokens.push({
                        type: "link",
                        start: i,
                        end: closeParen + 1,
                        textStart: i + 1,
                        textEnd: closeBracket,
                        urlStart: closeBracket + 2,
                        urlEnd: closeParen,
                    });
                    i = closeParen + 1;
                    continue;
                }
            }
        }

        i++;
    }

    return tokens;
}