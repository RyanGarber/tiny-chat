import type { HighlightResult } from "@streamdown/code";
import { Blockquote as _Blockquote } from "@tiptap/extension-blockquote";
import { CodeBlock as _CodeBlock } from "@tiptap/extension-code-block";
import { Document as _Document } from "@tiptap/extension-document";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import {
	Decoration,
	type DecorationAttrs,
	DecorationSet,
	type EditorView,
} from "@tiptap/pm/view";
import {
	Node,
	type NodeConfig,
	NodeViewContent,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { useEffect } from "react";
import { Blockquote } from "#frontend/core/components/Components.tsx";
import { useThemes } from "#frontend/features/settings/hooks/useThemes.ts";
import { createDirectiveSpec } from "#frontend/utils/input.ts";
import { codeThemesByTheme } from "#frontend/utils/theme.ts";
import { highlight } from "#frontend/utils/ui.tsx";

export const DocumentNode = _Document.extend({
	renderMarkdown: (node, h) => {
		if (!node.content) return "";
		return h.renderChildren(node.content, "\n");
	},
});

export const BlockquoteNode = _Blockquote.extend({
	addNodeView: () =>
		ReactNodeViewRenderer(() => (
			<NodeViewWrapper>
				<Blockquote>
					<NodeViewContent />
				</Blockquote>
			</NodeViewWrapper>
		)),
});

export const QuoteNode = Node.create({
	name: "quote",
	group: "block",
	content: "block+",
	atom: true,
	isolating: true,
	draggable: true,
	addAttributes: () => ({
		model: {
			default: null,
			parseHTML: (element) => element.getAttribute("data-model"),
			renderHTML: (attrs) => ({ "data-model": attrs.model as string }),
		},
	}),
	addNodeView: () =>
		ReactNodeViewRenderer(({ node }) => (
			<NodeViewWrapper contentEditable={false} data-drag-handle>
				<Blockquote
					model={node.attrs.model as string}
					style={{ cursor: "grab" }}
				>
					<NodeViewContent />
				</Blockquote>
			</NodeViewWrapper>
		)),
	parseHTML: () => [{ tag: "quote" }],
	renderHTML: ({ HTMLAttributes }) => ["quote", HTMLAttributes, 0],
	...createDirectiveSpec({
		nodeName: "quote",
		allowedAttributes: ["model"],
		content: "block",
	}),
} satisfies Partial<NodeConfig> as Partial<NodeConfig>);

export const CodeBlockKey = new PluginKey<CodeBlockPluginState>(
	"CodeBlockNode",
);

export const CodeBlockNode = _CodeBlock
	.configure({ enableTabIndentation: true, tabSize: 2 })
	.extend({
		addAttributes: () => ({
			codeTheme: { default: codeThemesByTheme("dark")[0] },
		}),
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
					view.dispatch(view.state.tr.setMeta(CodeBlockKey, true));
				});
			};

			return [
				new Plugin<CodeBlockPluginState>({
					key: CodeBlockKey,
					state: {
						init: (_, { doc }) =>
							computeCodeBlockState(doc, [], scheduleRedraw),
						apply: (tr, pluginState) => {
							if (tr.docChanged) {
								const blocks = pluginState.blocks.map((block) => ({
									...block,
									from: tr.mapping.map(block.from),
								}));
								return computeCodeBlockState(tr.doc, blocks, scheduleRedraw);
							}

							if (tr.getMeta(CodeBlockKey)) {
								return computeCodeBlockState(
									tr.doc,
									pluginState.blocks,
									scheduleRedraw,
								);
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
		addNodeView: () =>
			ReactNodeViewRenderer(({ updateAttributes }) => {
				const { codeTheme } = useThemes();
				useEffect(() => {
					updateAttributes({ codeTheme: codeTheme.data });
				}, [updateAttributes, codeTheme.data]);
				return (
					<NodeViewWrapper>
						<pre>
							<NodeViewContent as={"code" as "div"} />
						</pre>
					</NodeViewWrapper>
				);
			}),
	});

type CodeBlockEntry = {
	from: number;
	language: string;
	theme: string;
	result: HighlightResult;
};

type CodeBlockPluginState = {
	decorations: DecorationSet;
	blocks: CodeBlockEntry[];
};

function computeCodeBlockState(
	doc: EditorState["doc"],
	previousBlocks: CodeBlockEntry[],
	onAsyncReady: () => void,
): CodeBlockPluginState {
	const decorations: Decoration[] = [];
	const blocks: CodeBlockEntry[] = [];

	doc.descendants((node, pos) => {
		if (node.type.name !== "codeBlock") return;

		const text = node.textContent;
		const language = (node.attrs.language as string) ?? "typescript";
		const theme = node.attrs.codeTheme as string;

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
		const placeholder = highlight(language, theme, text, (resolved) => {
			if (settled) {
				// Fired asynchronously, well after this function returned:
				// ask the caller to redraw so the new tokens get applied.
				onAsyncReady();
			} else {
				fresh = resolved;
			}
		});
		settled = true;

		const result = fresh ?? previous?.result ?? placeholder;
		blocks.push({
			from: pos,
			language,
			theme,
			result: fresh ?? previous?.result ?? placeholder,
		});

		updateCodeBlockState(pos, node, text, result, decorations);
	});

	return { decorations: DecorationSet.create(doc, decorations), blocks };
}

function updateCodeBlockState(
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
		Decoration.node(pos, pos + node.nodeSize, { style: toStyleAttr(style) }),
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
					tokenAttrs(token),
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

function tokenAttrs(
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

function toStyleAttr(style: Record<string, string>): string {
	return Object.keys(style).reduce((accumulator, key) => {
		const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
		return `${accumulator}${cssKey}:${style[key]};`;
	}, "");
}
