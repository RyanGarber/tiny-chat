import type { HighlightResult } from "@streamdown/code";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
import { CodeUtils } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { CodeBlock as _CodeBlock } from "@tiptap/extension-code-block";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import {
	Decoration,
	type DecorationAttrs,
	DecorationSet,
	type EditorView,
} from "@tiptap/pm/view";
import {
	NodeViewContent,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { useEffect } from "react";

type CodeBlockEntry = {
	from: number;
	language: string | null;
	theme: string | null;
	result: HighlightResult;
};

type CodeBlockPluginState = {
	decorations: DecorationSet;
	blocks: CodeBlockEntry[];
};

const key = new PluginKey<CodeBlockPluginState>("CodeBlock");

const CodeBlock = _CodeBlock
	.configure({ enableTabIndentation: true, tabSize: 2 })
	.extend({
		addAttributes() {
			return {
				codeTheme: { default: null },
				language: {
					default: null,
					parseHTML: (element) => {
						const { languageClassPrefix } = this.options;

						if (!languageClassPrefix) {
							return null;
						}

						const classNames = [
							...(element.firstElementChild?.classList || []),
						];
						const languages = classNames
							.filter((className) => className.startsWith(languageClassPrefix))
							.map((className) => className.replace(languageClassPrefix, ""));
						const language = languages[0];

						if (!language) {
							return null;
						}

						return language;
					},
					rendered: false,
				},
			};
		},
		// ArrowUp
		addProseMirrorPlugins() {
			let view: EditorView | null = null;
			let redrawScheduled = false;

			const scheduleRedraw = () => {
				if (redrawScheduled) return;
				redrawScheduled = true;
				queueMicrotask(() => {
					redrawScheduled = false;
					if (!view || view.isDestroyed) return;
					view.dispatch(view.state.tr.setMeta(key, true));
				});
			};

			return [
				new Plugin<CodeBlockPluginState>({
					key: key,
					state: {
						init: (_, { doc }) => onHighlight(doc, [], scheduleRedraw),
						apply: (tr, pluginState) => {
							if (tr.docChanged) {
								const blocks = pluginState.blocks.map((block) => ({
									...block,
									from: tr.mapping.map(block.from),
								}));
								return onHighlight(tr.doc, blocks, scheduleRedraw);
							}

							if (tr.getMeta(key)) {
								return onHighlight(tr.doc, pluginState.blocks, scheduleRedraw);
							}

							return {
								decorations: pluginState.decorations.map(tr.mapping, tr.doc),
								blocks: pluginState.blocks,
							};
						},
					},
					props: {
						decorations(state) {
							return this.getState(state)?.decorations;
						},
					},
					view: (editorView) => {
						view = editorView;
						return {
							destroy: () => {
								view = null;
							},
						};
					},
				}),
			];
		},
		addNodeView() {
			return ReactNodeViewRenderer(({ updateAttributes }) => {
				const { codeTheme } = useThemes();
				useEffect(() => {
					queueMicrotask(() => {
						updateAttributes({ codeTheme: codeTheme });
					});
				}, [updateAttributes, codeTheme]);
				return (
					<NodeViewWrapper>
						<pre style={{ fontSize: "0.875rem" }}>
							<NodeViewContent as={"code" as "div"} />
						</pre>
					</NodeViewWrapper>
				);
			});
		},
	});

function onHighlight(
	doc: EditorState["doc"],
	previousBlocks: CodeBlockEntry[],
	onAsyncReady: () => void,
): CodeBlockPluginState {
	const decorations: Decoration[] = [];
	const blocks: CodeBlockEntry[] = [];

	doc.descendants((node, pos) => {
		if (node.type.name !== "codeBlock") return;

		const text = node.textContent;
		const language = node.attrs.language as string | null;
		const theme = node.attrs.codeTheme as string | null;

		const previous = previousBlocks.find(
			(block) =>
				block.from === pos &&
				block.language === language &&
				block.theme === theme,
		);

		// `settled` distinguishes a synchronous answer (already cached, or the
		// language isn't supported) from one that will only arrive later.
		let settled = false;
		let fresh: HighlightResult | undefined;
		const placeholder =
			CodeUtils.highlight({ language, theme, code: text }, (resolved) => {
				if (settled) {
					// Fired asynchronously, well after this function returned:
					// ask the caller to redraw so the new tokens get applied.
					onAsyncReady();
				} else {
					fresh = resolved;
				}
			}) ?? CodeUtils.unhighlight(text);
		settled = true;

		const result = fresh ?? previous?.result ?? placeholder;
		blocks.push({
			from: pos,
			language,
			theme,
			result: fresh ?? previous?.result ?? placeholder,
		});

		toDecorations(pos, node, text, result, decorations);
	});

	return { decorations: DecorationSet.create(doc, decorations), blocks };
}

function toDecorations(
	pos: number,
	node: ProseMirrorNode,
	text: string,
	result: HighlightResult,
	decorations: Decoration[],
) {
	const style: Record<string, string> = {};
	if (result.bg) style["background-color"] = result.bg;
	if (result.fg) style["--sdm-fg"] = result.fg;
	if (result.rootStyle) Object.assign(style, result.rootStyle);
	style.padding = "0.5rem";
	style["border-radius"] = "1rem";

	decorations.push(
		Decoration.node(pos, pos + node.nodeSize, {
			style: CommonUtils.toStyleString(style),
		}),
	);

	const lines = text.split("\n");
	let lineStart = pos + 1;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		const row = result.tokens[lineIndex] ?? [];
		let offset = 0;

		for (const token of row) {
			if (offset >= line.length) break;

			const length = Math.min(token.content.length, line.length - offset);
			if (length <= 0) continue;

			decorations.push(
				Decoration.inline(
					lineStart + offset,
					lineStart + offset + length,
					toDecorationAttributes(token),
				),
			);
			offset += length;
		}

		// Any characters beyond the (possibly stale) tokens are left plain
		// rather than risking an out-of-bounds or misaligned decoration.

		// +1 accounts for the `\n` ProseMirror keeps in the text node between lines.
		lineStart += line.length + 1;
	}
}

function toDecorationAttributes(
	token: HighlightResult["tokens"][number][number],
): DecorationAttrs {
	let style = "";
	let hasBg = Boolean(token.bgColor);

	if (token.color) style += `--sdm-c: ${token.color};`;
	if (token.bgColor) style += `--sdm-tbg: ${token.bgColor};`;

	if (token.htmlStyle) {
		for (const [key, value] of Object.entries(token.htmlStyle)) {
			if (key === "color") style += `--sdm-c: ${value};`;
			else if (key === "background-color") {
				style += `--sdm-tbg: ${value};`;
				hasBg = true;
			} else {
				style += `${key}: ${value};`;
			}
		}
	}

	const className =
		`text-(--sdm-c,inherit) dark:text-(--shiki-dark,var(--sdm-c,inherit)) ${hasBg ? "bg-(--sdm-tbg) dark:bg-(--shiki-dark-bg,var(--sdm-tbg))" : ""}`.trim();

	return {
		style,
		class: className,
		...token.htmlAttrs, // pass any other Shiki attrs directly to the DOM
	};
}

export const useCodeBlock = () => {
	return CodeBlock;
};
