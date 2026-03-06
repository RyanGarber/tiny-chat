import {type tRPC} from "@tiny-chat/core-backend/server";
import {createTRPCClient, httpLink} from "@trpc/client";
import {Children, isValidElement, ReactNode, useEffect, useRef, useState} from "react";
import {createAuthClient} from "better-auth/react";
import {anonymousClient, inferAdditionalFields} from "better-auth/client/plugins";
import superjson from "superjson";
import {auth as serverAuth} from "@tiny-chat/core-backend/server.ts";
import {zData, zGenerateInput, zGenerateOutput} from "@tiny-chat/core-backend/types.ts";
import {notifications} from "@mantine/notifications";
import {CodeHighlightAdapter} from "@mantine/code-highlight";
import hljs from "highlight.js";
import {useServices} from "@/managers/services.tsx";

declare global {
    interface Window {
        __TAURI__?: any;
    }
}
declare const __TAURI_DEV_HOST__: string | undefined; // TODO - set this on regular dev:web somehow?
// TODO - would logically set an env var somewhere that says 'this is dev; here is host ip'

export const webUrl = import.meta.env.DEV ? `http://${__TAURI_DEV_HOST__ ?? "localhost"}:${import.meta.env.VITE_WEB_PORT}` : import.meta.env.VITE_WEB_URL;

export const trpc = createTRPCClient<tRPC>({
    links: [
        httpLink({
            url: import.meta.env.DEV
                ? `http://${__TAURI_DEV_HOST__ ?? "localhost"}:${import.meta.env.VITE_BACKEND_PORT}${import.meta.env.VITE_BACKEND_PATH_TRPC}`
                : `${import.meta.env.VITE_BACKEND_URL}${import.meta.env.VITE_BACKEND_PATH_TRPC}`,
            transformer: superjson,
            headers: () => {
                const token = localStorage.getItem("token");
                return {Authorization: token ? `Bearer ${token}` : undefined};
            },
        }),
    ],
});

export const auth = createAuthClient({
    baseURL: import.meta.env.DEV
        ? `http://${__TAURI_DEV_HOST__ ?? "localhost"}:${import.meta.env.VITE_BACKEND_PORT}`
        : import.meta.env.VITE_BACKEND_URL,
    basePath: import.meta.env.VITE_BACKEND_PATH_AUTH,
    fetchOptions: {
        auth: {
            type: "Bearer",
            token: () => localStorage.getItem("token") ?? undefined
        }
    },
    plugins: [
        anonymousClient(),
        inferAdditionalFields<typeof serverAuth>(),
    ],
});

export const consumeLabel = {
    root: {
        position: "relative"
    },
    input: {
        height: 54,
        paddingTop: 18,
    },
    label: {
        position: "absolute",
        pointerEvents: "none",
        fontSize: "var(--mantine-font-size-xs)",
        paddingLeft: "var(--mantine-spacing-sm)",
        paddingTop: "calc(var(--mantine-spacing-sm) / 2)",
        zIndex: 1,
    }
} as any;

export const hashText = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = (hash << 5) - hash + char;
    }
    return (hash >>> 0).toString(36).padStart(7, '0');
};

export function alert(type: "info" | "warning" | "error", message: string) {
    const color = type === "error" ? "red" : type === "warning" ? "yellow" : undefined;
    notifications.show({message, color});
}

export function extractThoughts(data: zData) {
    return data.filter((part) => part.type === "thought").map(t => t.value);
}

// TODO - added 'hidden' field for file heading; moved to onSend... will we want to keep it?
export function extractText(data: zData, includeHidden = false) {
    let textParts: string[] = [];
    for (const part of data) {
        if (part.type === "text" && (includeHidden || !part.hidden)) {
            textParts.push(part.value);
        }
    }
    return textParts.join("\n"); // TODO - newlines?
}

export function inspect(obj: any, currentPath = "") {
    Object.keys(obj).forEach((key) => {
        const value = obj[key];
        const path = currentPath ? `${currentPath}.${key}` : key;
        if (typeof value !== "object") {
            console.log(
                `> ${path}: ${typeof value}${typeof value !== "symbol" ? ` = '${value}` : ""}'${value.name ? ` (from ${value.name})` : ""}`,
            );
        } else if (value !== null) {
            inspect(value, path);
        }
    });
}

export function getTextFromChildren(children: ReactNode): string {
    let text = "";
    Children.forEach(children, (child) => {
        if (typeof child === "string" || typeof child === "number") {
            text += child;
        } else if (isValidElement(child)) {
            text += getTextFromChildren((child.props as any).children);
        } else if (Array.isArray(child)) {
            text += getTextFromChildren(child);
        }
    });
    return text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .join("\n");
}

export function snippetText(text: string, query: string, window: number = 160): string {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const lower = text.toLowerCase();
    let matchIndex = -1;
    for (const term of terms) {
        const idx = lower.indexOf(term);
        if (idx !== -1) {
            matchIndex = idx;
            break;
        }
    }
    if (matchIndex === -1) return text.length > window ? text.slice(0, window) + "…" : text;
    const half = Math.floor(window / 2);
    let start = Math.max(0, matchIndex - half);
    let end = Math.min(text.length, matchIndex + half);
    // Snap to nearest word boundaries
    if (start > 0) {
        const i = text.indexOf(" ", start);
        if (i !== -1 && i < matchIndex) start = i + 1;
    }
    if (end < text.length) {
        const i = text.lastIndexOf(" ", end);
        if (i !== -1 && i > matchIndex) end = i;
    }
    const snippet = text.slice(start, end).trim();
    return (start > 0 ? "…" : "") + snippet + (end < text.length ? "…" : "");
}

export function scrubText(text: string, maxLength: number = -1): string {
    if (text.split("\n")[0].match(/^\[(user|assistant)/)) {
        text = text.slice(text.indexOf("\n") + 1);
        if (!text.split("\n")[0].trim().length) text = text.slice(text.indexOf("\n") + 1);
    }
    text = text
        .replace(/::model=[^:]+::/g, "") // Remove quote model tags
        .replace(/::>::\s?(.*)/g, "$1") // Remove quote markers
        .replace(/!\[.*?]\(.*?\)/g, "") // Remove images
        .replace(/\[([^\]]+)]\((.*?)\)/g, "$1") // Remove links but keep text
        .replace(/(`{1,3})(.*?)\1/g, "$2") // Remove inline code and code blocks
        .replace(/(\*\*|__)(.*?)\1/g, "$2") // Remove bold
        .replace(/([*_])(.*?)\1/g, "$2") // Remove italics
        .replace(/~~(.*?)~~/g, "$1") // Remove strikethrough
        .replace(/#+\s?(.*)/g, "$1") // Remove headings
        .replace(/>\s?(.*)/g, "$1") // Remove blockquotes
        .replace(/-\s?(.*)/g, "$1") // Remove unordered list markers
        .replace(/\d+\.\s?(.*)/g, "$1") // Remove ordered list markers
        .replace(/\n/g, " ") // Replace multiple newlines with a single newline
        .trim();
    if (maxLength > 0 && text.length > maxLength) {
        return text.substring(0, maxLength) + "...";
    }
    return text;
}

const hljsThemes = import.meta.glob("./*.min.css", {
    base: "/../../node_modules/highlight.js/styles",
    query: "?url",
    import: "default"
});

export const hljsThemeNames = Object.keys(hljsThemes).map(t => t.slice(2, -8));

export const applyHljsTheme = async (theme: string) => {
    let link = document.getElementById('hljs-theme') as HTMLLinkElement | null;
    if (link?.dataset.current === theme) return;
    if (!link) {
        link = document.createElement('link');
        link.id = 'hljs-theme';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    link.dataset.current = theme;

    await new Promise<void>(async (resolve) => {
        link.onload = () => resolve();
        link.href = (await hljsThemes[`./${theme}.min.css`]()) as string;
    });

    let backgroundColor;

    for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule && rule.selectorText === '.hljs') {
                const value = rule.style.background || rule.style.backgroundColor;
                if (value) backgroundColor = value;
            }
        }
    }

    document.documentElement.style.setProperty('--hljs-bg', backgroundColor ?? 'transparent');
};

export const hljsAdapter: CodeHighlightAdapter = {
    getHighlighter: () => ({code, language}) => {
        code = code.trim();
        const languageFound = !language || hljs.getLanguage(language) !== undefined;
        const result = language && languageFound ? hljs.highlight(code, {
            language,
            ignoreIllegals: true
        }) : hljs.highlightAuto(code);
        return {
            isHighlighted: true,
            highlightedCode: result.value,
            codeElementProps: {className: `hljs ${result.language}`},
        };
    }
}

export async function openExternal(url: string) {
    console.log(`Opening link externally: ${url}`);

    if ("__TAURI__" in window) {
        const {openUrl} = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
        return;
    }

    // Normal browser
    window.open(url, "_blank", "noopener,noreferrer");
}

export function useViewport() {
    const [height, setHeight] = useState(
        window.visualViewport?.height ?? window.innerHeight,
    );
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        let frameId: number;

        const onUpdate = () => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                setHeight(vv.height);
                if (containerRef.current) containerRef.current.style.transform = `translateY(${vv.offsetTop}px)`
            });
        };

        // Immediately set initial values
        onUpdate();

        vv.addEventListener("resize", onUpdate);
        vv.addEventListener("scroll", onUpdate);
        return () => {
            cancelAnimationFrame(frameId);
            vv.removeEventListener("resize", onUpdate);
            vv.removeEventListener("scroll", onUpdate);
        };
    }, []);

    return {height, containerRef};
}

export async function* generate(input: zGenerateInput, signal?: AbortSignal) {
    const url = import.meta.env.DEV
        ? `http://${__TAURI_DEV_HOST__ ?? "localhost"}:${import.meta.env.VITE_BACKEND_PORT}/@/stream/generate`
        : `${import.meta.env.VITE_BACKEND_URL}/@/stream/generate`;

    const args = useServices.getState().services.find(s => s.name === input.config.service)?.models.find(m => m.name === input.config.model)?.args ?? [];
    console.log("Args:", args);
    for (const arg of args) {
        if (input.config.args?.[arg.name] === undefined) {
            console.log(`Using default value for arg ${arg.name}:`, arg.default)
            if (input.config.args === undefined) input.config.args = {};
            input.config.args[arg.name] = arg.default;
        }
    }

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
        },
        body: JSON.stringify(input),
        signal,
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split('\n\n');
        buffer = lines.pop()!;

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                yield zGenerateOutput.parse(JSON.parse(line.slice(6)));
            }
        }
    }
}