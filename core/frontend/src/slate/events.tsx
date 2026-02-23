import {KeyboardEvent} from "react";
import {useLayout} from "@/managers/layout.tsx";
import {useMessaging} from "@/managers/messaging.tsx";
import {serialize} from "@/slate/serializer.tsx";
import {zDataPartType} from "@tiny-chat/core-backend/types.ts";
import {Editor, Path, Text, Transforms} from "slate";
import {tokenize} from "@/slate/tokenizer.tsx";

type MarkSyntax = "bold" | "italic" | "code";

/** Returns the {start, end} offsets of the contiguous non-whitespace word that
 *  the cursor is touching (immediately adjacent on either side), or null if the
 *  cursor is surrounded by whitespace / at a boundary with no adjacent word. */
function getWordBounds(text: string, offset: number): { start: number; end: number } | null {
    const isWordChar = (c: string) => /\S/.test(c);
    const touchesLeft = offset > 0 && isWordChar(text[offset - 1]);
    const touchesRight = offset < text.length && isWordChar(text[offset]);
    if (!touchesLeft && !touchesRight) return null;

    let start = offset;
    while (start > 0 && isWordChar(text[start - 1])) start--;

    let end = offset;
    while (end < text.length && isWordChar(text[end])) end++;

    return {start, end};
}

function toggleMark(syntax: MarkSyntax) {
    const {editor} = useMessaging.getState();
    if (!editor || !editor.selection) return;

    const markers = syntax === "bold" ? "**" : syntax === "italic" ? "*" : "`";
    const markerLen = markers.length;

    const {anchor, focus} = editor.selection;

    // Only handle selections within a single text leaf
    if (!Path.equals(anchor.path, focus.path)) return;

    const path = anchor.path;
    const [node] = Editor.node(editor, path);
    if (!Text.isText(node)) return;

    const text = node.text;
    const selStart = Math.min(anchor.offset, focus.offset);
    const selEnd = Math.max(anchor.offset, focus.offset);
    const hasSelection = selStart !== selEnd;

    const tokens = tokenize(text);

    if (hasSelection) {
        // Check if the selection covers a token exactly (full bounds or inner content)
        const matchingToken = tokens.find(t =>
            t.type === syntax && (
                (t.start === selStart && t.end === selEnd) ||                            // full token selected
                (t.start + markerLen === selStart && t.end - markerLen === selEnd)       // inner content selected
            )
        );

        if (matchingToken) {
            // Toggle OFF: delete closing markers first (higher offset), then opening markers
            Editor.withoutNormalizing(editor, () => {
                Transforms.delete(editor, {
                    at: {path, offset: matchingToken.end - markerLen},
                    distance: markerLen,
                    unit: "character",
                });
                Transforms.delete(editor, {
                    at: {path, offset: matchingToken.start},
                    distance: markerLen,
                    unit: "character",
                });
                // Restore selection to the now-unwrapped inner content
                Transforms.select(editor, {
                    anchor: {path, offset: matchingToken.start},
                    focus: {path, offset: matchingToken.end - markerLen * 2},
                });
            });
        } else {
            // Toggle ON: insert closing marker first (won't shift selStart), then opening
            Editor.withoutNormalizing(editor, () => {
                Transforms.insertText(editor, markers, {at: {path, offset: selEnd}});
                Transforms.insertText(editor, markers, {at: {path, offset: selStart}});
                // Keep selection covering the original text (shifted right by opening marker)
                Transforms.select(editor, {
                    anchor: {path, offset: selStart + markerLen},
                    focus: {path, offset: selEnd + markerLen},
                });
            });
        }
    } else {
        // No selection — check if cursor sits inside an existing token
        const cursorOffset = anchor.offset;
        const insideToken = tokens.find(t =>
            t.type === syntax && cursorOffset > t.start && cursorOffset < t.end
        );

        if (insideToken) {
            // Toggle OFF: delete closing markers first, then opening markers
            const pastCloseMarker = cursorOffset > insideToken.end - markerLen;
            Editor.withoutNormalizing(editor, () => {
                Transforms.delete(editor, {
                    at: {path, offset: insideToken.end - markerLen},
                    distance: markerLen,
                    unit: "character",
                });
                Transforms.delete(editor, {
                    at: {path, offset: insideToken.start},
                    distance: markerLen,
                    unit: "character",
                });
                // Reposition cursor: subtract markerLen for each removed marker set that
                // was at or before the original cursor position
                let newOffset = cursorOffset - markerLen; // always: opening markers are before cursor
                if (pastCloseMarker) newOffset -= markerLen; // cursor was inside closing markers too
                newOffset = Math.max(
                    insideToken.start,
                    Math.min(newOffset, insideToken.end - markerLen * 2),
                );
                Transforms.select(editor, {anchor: {path, offset: newOffset}, focus: {path, offset: newOffset}});
            });
        } else {
            const wordBounds = getWordBounds(text, cursorOffset);
            if (wordBounds) {
                // Cursor is touching a word — wrap the entire word with the markers.
                // Insert closing marker first so opening marker offset stays valid.
                Editor.withoutNormalizing(editor, () => {
                    Transforms.insertText(editor, markers, {at: {path, offset: wordBounds.end}});
                    Transforms.insertText(editor, markers, {at: {path, offset: wordBounds.start}});
                    // Keep cursor at its original logical position inside the now-marked word
                    const newOffset = cursorOffset + markerLen;
                    Transforms.select(editor, {anchor: {path, offset: newOffset}, focus: {path, offset: newOffset}});
                });
            } else {
                // Toggle ON: insert markers pair at cursor, place cursor between them
                Transforms.insertText(editor, markers + markers, {at: {path, offset: cursorOffset}});
                const between = cursorOffset + markerLen;
                Transforms.select(editor, {anchor: {path, offset: between}, focus: {path, offset: between}});
            }
        }
    }
}

export async function onSend() {
    const {editor, files, sendMessage, clearEditor} = useMessaging.getState();
    if (!editor) return;

    const content = serialize();
    if (content.trim() === "") return;
    console.log("Sending:", editor.children, "serialized to:", content);
    const parts: zDataPartType[] = [];
    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(files[i]);
        });
        parts.push({
            type: "file",
            name: files[i].name,
            mime: files[i].type,
            url: reader.result as string,
        });
    }
    parts.push({type: "text", value: content});
    useMessaging.getState().requestScrollToBottom();
    void sendMessage(parts);
    clearEditor();

}

export function onKeyDown(event: KeyboardEvent) {
    const {editor} = useMessaging.getState();
    if (!editor) return;

    if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !useLayout.getState().isMobile
    ) {
        event.preventDefault();
        void onSend();
    }

    if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
            case "b":
                event.preventDefault();
                toggleMark("bold");
                break;
            case "i":
                event.preventDefault();
                toggleMark("italic");
                break;
            case "`":
                event.preventDefault();
                toggleMark("code");
                break;
            default:
                break;
        }
    }
}
