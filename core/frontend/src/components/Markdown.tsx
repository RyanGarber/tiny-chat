import {CSSProperties, Fragment, memo} from "react";
import {getTextFromChildren, openExternal} from "@/utils.ts";
import ReactMarkdown, {Components} from "react-markdown";
import {Blockquote, Typography} from "@mantine/core";
import RemarkGfm from "remark-gfm";
import RemarkBreaks from "remark-breaks";
import {CodeHighlight} from "@mantine/code-highlight";

const STREAMING_MARKER = "\uE000";

const components: Components = {
    blockquote: (node) => {
        const text = getTextFromChildren(node.children);
        if (text.trim().startsWith("::>:: ")) {
            return (
                <Blockquote className="ignore-typography">
                    {text.split("\n").map((line, index) => (
                        <Fragment key={index}>
                            {line.replace(/^::>::\s?/gm, "")}
                            {index < text.split("\n").length - 1 && <br/>}
                        </Fragment>
                    ))}
                </Blockquote>
            );
        }
        return <Blockquote>{node.children}</Blockquote>;
    },
    code: (node) => {
        const rawCode = String(node.children ?? "");
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
                               withExpandButton
                               defaultExpanded={code.split("\n").length <= 7}/>
            </div>
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

const filter = (text: string) => {
    text = text.replace(/^::>:: (.*)$/gm, "> ::>:: $1");
    const backticks = text.match(/```/g)?.length ?? 0;
    if (backticks !== 0 && backticks % 2 !== 0) {
        text = text + STREAMING_MARKER + "\n```";
    }
    return text;
}

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