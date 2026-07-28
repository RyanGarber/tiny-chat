import { Box, type BoxProps } from "@mantine/core";
import { createCodePlugin } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { memo, useMemo } from "react";
import RemarkBreaks from "remark-breaks";
import RemarkDirective from "remark-directive";
import {
	type AnimateOptions,
	type Components,
	defaultRemarkPlugins,
	type PluginConfig,
	Streamdown,
} from "streamdown";
import { visit } from "unist-util-visit";
import {
	AComponent,
	BlockquoteComponent,
	CiteComponent,
	LinkComponent,
	SlotComponent,
} from "#frontend/features/message/components/MarkdownComponents.tsx";
import { useThemes } from "#frontend/features/settings/hooks/useThemes.ts";
import { MarkdownContext } from "#frontend/utils/data.ts";
import "katex/dist/katex.min.css";
import type { Nodes, Root } from "mdast";

import IntrinsicElements = React.JSX.IntrinsicElements;

// TODO - verify <Code> is optimized enough to swap in for auto highlight
const markdownComponents: Components = {
	blockquote: BlockquoteComponent,
	a: AComponent,
	link: LinkComponent,
	cite: CiteComponent,
	slot: SlotComponent,
};

// reference tag passes id + animate index through sanitizer; all others blocked by default
const CUSTOM_TAGS: Partial<Record<keyof IntrinsicElements, string[]>> = {
	blockquote: ["model"],
	cite: ["sources"],
	link: ["source", "is-directory"],
	slot: ["name", "value", "accepts-content", "needs-run"],
};

const directive = (
	node: Nodes,
	name: string,
	toName: keyof IntrinsicElements,
) => {
	if (
		node.type !== "containerDirective" &&
		node.type !== "leafDirective" &&
		node.type !== "textDirective"
	)
		return;

	if (node.name !== name) return;

	node.data ??= {};
	node.data.hName = toName;
	node.data.hProperties = { ...node.attributes };
};

const REMARK_PLUGINS = [
	...Object.values(defaultRemarkPlugins),
	RemarkBreaks,
	RemarkDirective,
	function directives() {
		return (tree: Root) => {
			visit(tree, (node) => {
				directive(node, "quote", "blockquote");
				directive(node, "writing", "blockquote");
				directive(node, "command", "slot");
				directive(node, "attachment", "link");
			});
		};
	},
];

const ANIMATE_OPTIONS: AnimateOptions = {
	animation: "blurIn",
	duration: 150,
	easing: "ease",
	stagger: 5,
	sep: "word",
};

export const Markdown = memo(
	({
		source,
		boxProps,
		context = {
			webReferences: [],
			memoryReferences: [],
			actionReferences: [],
			isGenerating: false,
		},
	}: {
		source: string;
		boxProps?: BoxProps;
		context?: MarkdownContext;
	}) => {
		const { codeTheme, theme } = useThemes();

		const props = useMemo(
			() => ({
				...boxProps,
				style: { overflowWrap: "break-word" as const, ...boxProps?.style },
			}),
			[boxProps],
		);

		const plugins = useMemo<PluginConfig>(
			() => ({
				math: createMathPlugin({ singleDollarTextMath: false }),
				mermaid,
				code: createCodePlugin({ themes: [codeTheme.data, codeTheme.data] }),
			}),
			[codeTheme.data],
		);

		return (
			<MarkdownContext.Provider value={context}>
				<Box {...props}>
					<Streamdown
						animated={ANIMATE_OPTIONS}
						isAnimating={context.isGenerating}
						mode={context.isGenerating ? "streaming" : "static"}
						components={markdownComponents}
						allowedTags={CUSTOM_TAGS}
						plugins={plugins}
						remarkPlugins={REMARK_PLUGINS}
						shikiTheme={[codeTheme.data, codeTheme.data]}
						mermaid={{
							config: { theme: theme.data === "dark" ? "dark" : "neutral" },
						}}
						className="selectable"
					>
						{source}
					</Streamdown>
				</Box>
			</MarkdownContext.Provider>
		);
	},
	(prev, next) =>
		prev.source === next.source &&
		prev.boxProps === next.boxProps &&
		prev.context?.isGenerating === next.context?.isGenerating &&
		prev.context?.webReferences === next.context?.webReferences &&
		prev.context?.memoryReferences === next.context?.memoryReferences &&
		prev.context?.actionReferences === next.context?.actionReferences,
);
