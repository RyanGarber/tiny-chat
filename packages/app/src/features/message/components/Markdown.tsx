import { Box, type BoxProps } from "@mantine/core";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { useThemes } from "@tiny-chat/client/src/features/settings/hooks/useThemes.ts";
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
} from "#app/features/message/components/MarkdownComponents.tsx";
import { MarkdownContext } from "#app/features/message/components/MarkdownContext.tsx";
import "katex/dist/katex.min.css";
import type { Nodes, Root } from "mdast";
import type { JSX } from "react";
import { CodeUtils } from "#app/core/utils/CodeUtils.ts";

const COMPONENTS: Components = {
	blockquote: BlockquoteComponent,
	a: AComponent,
	link: LinkComponent,
	mark: CiteComponent,
	slot: SlotComponent,
};

// reference tag passes id + animate index through sanitizer; all others blocked by default
const ALLOWED_TAGS: Partial<Record<keyof JSX.IntrinsicElements, string[]>> = {
	blockquote: ["model"],
	mark: ["sources"],
	link: ["source", "is-directory"],
	slot: ["name", "value", "accepts-content", "needs-run"],
};

const directive = (
	node: Nodes,
	name: string,
	toName: keyof JSX.IntrinsicElements,
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
			fileReferences: [],
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
				code: CodeUtils.plugin(codeTheme.data),
			}),
			[codeTheme.data],
		);

		// TODO WIP - replace this
		const content = useMemo(() => {
			return source.replace(/<cite([/ ])/g, "<mark$1");
		}, [source]);

		return (
			<MarkdownContext.Provider value={context}>
				<Box {...props}>
					<Streamdown
						animated={ANIMATE_OPTIONS}
						isAnimating={context.isGenerating}
						mode={context.isGenerating ? "streaming" : "static"}
						components={COMPONENTS}
						allowedTags={ALLOWED_TAGS}
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
	(previous, next) => previous.source === next.source,
);
