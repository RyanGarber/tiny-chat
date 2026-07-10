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
	BlockquoteComponent,
	CiteComponent,
	LinkComponent,
} from "#frontend/features/message/components/MarkdownComponents.tsx";
import { useThemes } from "#frontend/features/settings/hooks/useThemes.ts";
import { MarkdownContext } from "#frontend/utils/data.ts";
import "katex/dist/katex.min.css";
import type { Root } from "mdast";
import { xmlToDirective } from "#shared/utils/text.ts";

const markdownComponents: Components = {
	blockquote: BlockquoteComponent,
	a: LinkComponent,
	cite: CiteComponent,
};

// reference tag passes id + animate index through sanitizer; all others blocked by default
const CUSTOM_TAGS = {
	blockquote: ["model"],
	cite: ["type", "id", "url", "inline"],
};

const REMARK_PLUGINS = [
	...Object.values(defaultRemarkPlugins),
	RemarkBreaks,
	RemarkDirective,
	function directives() {
		return (tree: Root) => {
			visit(tree, (node) => {
				if (
					node.type === "containerDirective" ||
					node.type === "textDirective"
				) {
					if (node.name === "quote" || node.name === "writing") {
						node.data ??= {};
						node.data.hName = "blockquote";
						node.data.hProperties = { ...node.attributes };
					}
					if (node.name === "ref") {
						node.data ??= {};
						node.data.hName = "cite";
						node.data.hProperties = { ...node.attributes };
					}
				}
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

		const content = useMemo(() => {
			return xmlToDirective(source, ["ref"]);
		}, [source]);

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
						{content}
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
