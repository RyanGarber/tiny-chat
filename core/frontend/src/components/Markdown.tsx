import {CSSProperties, Fragment, memo} from "react";
import {getTextFromChildren, openExternal} from "@/utils.ts";
import ReactMarkdown, {Components} from "react-markdown";
import {Blockquote, Group, ScrollArea, Text, Typography} from "@mantine/core";
import RemarkGfm from "remark-gfm";
import RemarkBreaks from "remark-breaks";
import {CodeHighlight} from "@mantine/code-highlight";
import katex from "katex";
import 'katex/dist/katex.min.css';
import {IconQuoteFilled} from "@tabler/icons-react";

const STREAMING_MARKER = "\uE000";
const MATH_MARKER = "\uE001";

const renderKatex = (math: string, displayMode: boolean): string | null => {
    try {
        return katex.renderToString(math, {
            displayMode,
            throwOnError: false,
            output: "html",
        });
    } catch {
        return null;
    }
};

const components: Components = {
    blockquote: (node) => {
        const text = getTextFromChildren(node.children);
        if (text.trim().startsWith("::>:: ")) {
            const lines = text.split("\n");
            let modelName = "";
            let contentLines = lines;

            const firstContent = lines[0].replace(/^::>::\s?/, "");
            if (firstContent.startsWith("::model=") && firstContent.endsWith("::")) {
                modelName = firstContent.slice("::model=".length, -2);
                contentLines = lines.slice(1);
            }

            return (
                <>
                    {modelName && (
                        <Group gap={5} c="dimmed" mb={4}>
                            <IconQuoteFilled size={14} style={{transform: "scale(-1,1)"}}/>
                            <Text size="xs">{modelName}</Text>
                        </Group>
                    )}
                    <Blockquote className="ignore-typography" mb="var(--mantine-spacing-lg)">
                        {contentLines.map((line, index) => (
                            <Fragment key={index}>
                                {line.replace(/^::>::\s?/gm, "")}
                                {index < contentLines.length - 1 && <br/>}
                            </Fragment>
                        ))}
                    </Blockquote>
                </>
            );
        }
        return <Blockquote>{node.children}</Blockquote>;
    },
    code: (node) => {
        const rawCode = String(node.children ?? "");

        // Display math — converted from $$...$$ by filter()
        if (node.className === "language-math") {
            const html = renderKatex(rawCode.trim(), true);
            if (html) return <span className="math-display" dangerouslySetInnerHTML={{__html: html}}/>;
            return <pre>{rawCode}</pre>;
        }

        // Inline math — converted from $...$ by filter()
        if (!node.className && rawCode.startsWith(MATH_MARKER)) {
            const math = rawCode.slice(MATH_MARKER.length);
            const html = renderKatex(math, false);
            if (html) return <span className="math-inline" dangerouslySetInnerHTML={{__html: html}}/>;
            return <code>{math}</code>;
        }

        const isStreaming = rawCode.includes(STREAMING_MARKER);
        const code = (isStreaming ? rawCode.replace(STREAMING_MARKER, "") : rawCode).trimEnd();

        if (!node.className && !code.includes("\n")) {
            return <code>{code}</code>;
        }

        if (isStreaming) {
            return <pre style={{padding: 25, maxHeight: 180, overflow: "hidden"}}>{code}</pre>;
        }

        return (
            <div className="code-fade-in">
                <CodeHighlight code={code}
                               language={node.className?.replace("language-", "")}
                               withExpandButton={code.split("\n").length >= 8}
                               defaultExpanded={code.split("\n").length < 8}/>
            </div>
        );
    },
    table: (node) => {
        return (
            <ScrollArea scrollbars="x" type="always">
                <table>{node.children}</table>
            </ScrollArea>
        );
    },
    a: (node) => {
        return <a href={node.href} onClick={async (e) => {
            if (!node.href) return;
            e.preventDefault();
            await openExternal(node.href);
        }}>{node.children}</a>
    }
};

const LATEX_CHAR_RE = /[\\^_{}]/;

const filter = (text: string) => {
    if (text.split("\n")[0].match(/^\[(user|assistant)/)) {
        text = text.slice(text.indexOf("\n") + 1);
        if (!text.split("\n")[0].trim().length) text = text.slice(text.indexOf("\n") + 1);
    }

    text = text.replace(/((?:^::>:: .*$\n?)+)/gm, (block) =>
        block.replace(/^::>:: (.*)$/gm, "> ::>:: $1")
    );

    text = text.replace(
        /(`{3,}[\s\S]*?`{3,}|``[^`\n]*``|`[^`\n]+`)|^[ \t]*\$\$([\s\S]*?)\$\$[ \t]*$|^[ \t]*\\\[([\s\S]*?)\\\][ \t]*$|(?<![$\\])\$(?![\s\d])([^$\n]+?)(?<!\s)\$(?![$a-zA-Z_\d])|(?<!\\)\\\(([^\n]*?)\\\)/gm,
        (match, code, displayDollar, displayBracket, inlineDollar, inlineParen) => {
            if (code !== undefined) return match;

            const displayMath = displayDollar ?? displayBracket;
            if (displayMath !== undefined)
                return "```math\n" + displayMath.trim() + "\n```";

            if (inlineDollar !== undefined)
                return "`" + MATH_MARKER + inlineDollar + "`";

            if (inlineParen !== undefined && LATEX_CHAR_RE.test(inlineParen))
                return "`" + MATH_MARKER + inlineParen + "`";

            return match;
        }
    );

    const backticks = text.match(/```/g)?.length ?? 0;
    if (backticks !== 0 && backticks % 2 !== 0) {
        text = text + STREAMING_MARKER + "\n```";
    }
    return text;
};

export default memo(({source, style}: { source: string, style?: CSSProperties }) => {
    return (
        <Typography style={{overflowWrap: "break-word", ...style}}>
            <ReactMarkdown
                skipHtml
                remarkPlugins={[RemarkGfm, RemarkBreaks]}
                components={components}
            >
                {filter(source)}
            </ReactMarkdown>
        </Typography>
    );
}, (prev, next) => prev.source === next.source && prev.style === next.style);