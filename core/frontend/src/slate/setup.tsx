import {useMessaging} from "@/managers/messaging.tsx";
import {BaseElement, BaseText, createEditor, Editor, Transforms} from "slate";
import {withHistory} from "slate-history";
import {withReact} from "slate-react";

export function setupEditor() {
    const editor = withReact(withHistory(createEditor()));

    const {isVoid, isInline} = editor;
    editor.isVoid = (element) =>
        element.type === "quote" ? true : isVoid(element);
    editor.isInline = (element) =>
        element.type === "quote" ? false : isInline(element);

    const {onChange} = editor;

    editor.onChange = () => {
        onChange();

        const position = editor.selection?.anchor?.path[0] ?? null;
        useMessaging.getState().cursorPosition = position; // avoid rerender

        if (editor.selection) {
            const [node] = Editor.node(editor, [position ?? 0]);
            if ((node as BaseElement).hidden) {
                Transforms.unsetNodes(editor, "hidden", {
                    at: [position ?? 0],
                });
            }
        }
    };

    const {normalizeNode} = editor;
    editor.normalizeNode = (entry) => {
        const [node, path] = entry;

        const root = node as BaseElement;

        if (path.length === 0) {
            const checkHidden = (
                checkFirst: BaseElement,
                checkSecond: BaseElement,
                isFirst: boolean,
            ) => {
                let isAlone = root.children.length === 1;
                let isUnempty = (checkFirst.children[0] as BaseText).text.length > 0;
                let isRedundant = !isAlone && checkSecond.type === "paragraph";

                if (!checkFirst || checkFirst.type !== "paragraph") {
                    Transforms.insertNodes(
                        editor,
                        {type: "paragraph", children: [{text: ""}], hidden: true},
                        {at: path.concat(isFirst ? 0 : root.children.length)},
                    );
                    return;
                }

                const self = isFirst ? 0 : root.children.length - 1;
                if (checkFirst?.hidden) {
                    if (isAlone || isUnempty) {
                        if ((root.children[self] as BaseElement).hidden) {
                            Transforms.unsetNodes(editor, "hidden", {
                                at: path.concat(self),
                            });
                            return;
                        }
                    } else if (isRedundant) {
                        Transforms.removeNodes(editor, {
                            at: path.concat(self),
                        });
                        return;
                    }
                }
            };

            checkHidden(
                root.children[0] as BaseElement,
                root.children[1] as BaseElement,
                true,
            );

            checkHidden(
                root.children[root.children.length - 1] as BaseElement,
                root.children[root.children.length - 2] as BaseElement,
                false,
            );
        }

        return normalizeNode(entry);
    };

    return editor;
}
