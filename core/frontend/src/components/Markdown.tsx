import {CSSProperties, Fragment, memo} from "react";
import {getTextFromChildren, openExternal} from "@/utils.ts";
import ReactMarkdown, {Components} from "react-markdown";
import {Blockquote, Typography} from "@mantine/core";
import RemarkGfm from "remark-gfm";
import RemarkBreaks from "remark-breaks";
import {CodeHighlight} from "@mantine/code-highlight";
import katex from "katex";
import 'katex/dist/katex.min.css';

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

// \(...\) is only treated as math when the content contains at least one
// unambiguous LaTeX character (\  ^  _  {  }), so prose like \(see Appendix A\)
// or \(n + 1\) is left alone while \(\frac{x}{2}\) and \(x^2\) are converted.
const LATEX_CHAR_RE = /[\\^_{}]/;

const filter = (text: string) => {
    if (text.split("\n")[0].startsWith("[assistant")) text = text.slice(text.indexOf("\n") + 1);

    text = text.replace(/^::>:: (.*)$/gm, "> ::>:: $1");

    // Single ordered alternation — alternatives are tried left-to-right at every
    // position, so code is consumed first and never examined for math delimiters.
    //
    // Group 1 — verbatim code (returned unchanged):
    //   `{3,}…`{3,}   fenced code blocks (triple+ backticks)
    //   ``…``          double-backtick inline code  e.g. ``$HOME``
    //   `…`            single-backtick inline code  e.g. `$x`
    //
    // Group 2 — display math  $$…$$
    //   Opening $$ must be at the START of a line (^ with multiline flag).
    //   This prevents mid-line pairs like { left: '$$', right: '$$' } matching.
    //
    // Group 3 — display math  \[…\]
    //   Same line-anchor rule; \[ never appears for any other purpose in prose.
    //
    // Group 4 — inline math  $…$
    //   Opening $:  (?<![$\\])   not preceded by $ (avoids $$) or \ (avoids \$)
    //               (?![\s\d])   not followed by space or digit (currency: $300)
    //   Content:    [^$\n]+?     lazy; no $ or newline
    //   Closing $:  (?<!\s)      not preceded by whitespace
    //               (?![$a-zA-Z_\d])  not followed by $, letter, _, or digit
    //                                 (shell vars: $HOME/$PROJECT close on wrong $)
    //
    // Group 5 — inline math  \(…\)
    //   Heuristic: content must contain a LaTeX-specific character (\^_{})
    //   so that editorial parentheses like \(see below\) are left untouched.
    text = text.replace(
        /(`{3,}[\s\S]*?`{3,}|``[^`\n]*``|`[^`\n]+`)|^[ \t]*\$\$([\s\S]*?)\$\$[ \t]*$|^[ \t]*\\\[([\s\S]*?)\\\][ \t]*$|(?<![$\\])\$(?![\s\d])([^$\n]+?)(?<!\s)\$(?![$a-zA-Z_\d])|(?<!\\)\\\(([^\n]*?)\\\)/gm,
        (match, code, displayDollar, displayBracket, inlineDollar, inlineParen) => {
            // Group 1 — return code spans/fences verbatim
            if (code !== undefined) return match;

            // Groups 2 & 3 — display math
            const displayMath = displayDollar ?? displayBracket;
            if (displayMath !== undefined)
                return "```math\n" + displayMath.trim() + "\n```";

            // Group 4 — inline $…$ math
            if (inlineDollar !== undefined)
                return "`" + MATH_MARKER + inlineDollar + "`";

            // Group 5 — inline \(…\) math, guarded by heuristic
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