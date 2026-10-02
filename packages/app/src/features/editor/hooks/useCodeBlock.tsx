import { useThemes } from "@tiny-chat/client/features/settings/hooks/useThemes.ts";
import {
	type CodeRequest,
	type CodeResult,
	CodeUtils,
} from "@tiny-chat/core/core/utils/CodeUtils.ts";
import { CommonUtils } from "@tiny-chat/core/core/utils/CommonUtils.ts";
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
	request: CodeRequest;
	result: CodeResult;
	/** Aborts this block's pending highlight, if it has one. */
	controller: AbortController | null;
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
								for (const block of key.getState(editorView.state)?.blocks ??
									[]) {
									block.controller?.abort();
								}
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
	const reused = new Set<CodeBlockEntry>();

	doc.descendants((node, pos) => {
		if (node.type.name !== "codeBlock") return;

		const request: CodeRequest = {
			code: node.textContent,
			language: node.attrs.language as string | null,
			theme: node.attrs.codeTheme as string | null,
		};

		const previous = previousBlocks.find(
			(block) =>
				block.from === pos &&
				block.request.language === request.language &&
				block.request.theme === request.theme,
		);
		if (previous) reused.add(previous);

		// Draw now with whatever is known (cached tokens, or the last result
		// with unchanged lines kept) and redraw once the worker answers.
		const result = CodeUtils.placeholder(request, previous);
		let controller: AbortController | null = null;

		if (CodeUtils.peek(request)) {
			previous?.controller?.abort();
		} else if (
			previous?.controller &&
			!previous.controller.signal.aborted &&
			previous.request.code === request.code
		) {
			controller = previous.controller; // already on its way
		} else {
			previous?.controller?.abort();
			const created = new AbortController();
			controller = created;
			void CodeUtils.highlight(request, { signal: created.signal }).then(
				(resolved) => {
					if (resolved) onAsyncReady();
				},
			);
		}

		blocks.push({
			from: pos,
			request,
			// keep the last real highlight to reconcile against, not a placeholder
			result: CodeUtils.peek(request) ?? previous?.result ?? result,
			controller,
		});

		toDecorations(pos, node, request.code, result, decorations);
	});

	for (const block of previousBlocks) {
		if (!reused.has(block)) block.controller?.abort();
	}

	return { decorations: DecorationSet.create(doc, decorations), blocks };
}

function toDecorations(
	pos: number,
	node: ProseMirrorNode,
	text: string,
	result: CodeResult,
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
	token: CodeResult["tokens"][number][number],
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
