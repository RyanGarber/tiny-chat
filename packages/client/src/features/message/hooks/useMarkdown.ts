import type { Code, Nodes, Root } from "mdast";
import type {} from "mdast-util-to-hast";
import { type JSX, useMemo } from "react";
import RehypeKatex from "rehype-katex";
import RehypeRaw from "rehype-raw";
import RehypeSanitize, { defaultSchema } from "rehype-sanitize";
import RemarkBreaks from "remark-breaks";
import RemarkDirective from "remark-directive";
import RemarkGfm from "remark-gfm";
import RemarkMath from "remark-math";
import RemarkParse from "remark-parse";
import RemarkRehype from "remark-rehype";
import remend from "remend";
import { type PluggableList, unified } from "unified";
import { visit } from "unist-util-visit";

export type * from "mdast";
export type * from "mdast-util-to-hast";

const allowedTags: Partial<Record<keyof JSX.IntrinsicElements, string[]>> = {
	blockquote: ["model"],
	mark: ["sources"],
	link: ["source", "is-directory"],
	slot: ["name", "value", "accepts-content", "needs-run"],
};

const createDirectives = () => {
	const toNode = (
		node: Extract<
			Nodes,
			{ type: "textDirective" | "leafDirective" | "containerDirective" }
		>,
		name: keyof JSX.IntrinsicElements,
	) => {
		node.data ??= {};
		node.data.hName = name;
		node.data.hProperties = { ...node.attributes };
	};

	return (tree: Root) => {
		visit(tree, (node) => {
			if (
				node.type !== "containerDirective" &&
				node.type !== "leafDirective" &&
				node.type !== "textDirective"
			)
				return;

			if (node.name === "quote") toNode(node, "blockquote");
			if (node.name === "writing") toNode(node, "blockquote");
			if (node.name === "command") toNode(node, "slot");
			if (node.name === "attachment") toNode(node, "link");
		});
	};
};

const createCodeMeta = () => (tree: Root) => {
	visit(tree, "code", (node: Code) => {
		if (node.meta) {
			node.data = node.data ?? {};
			node.data.hProperties = {
				...((node.data.hProperties as Record<string, unknown>) ?? {}),
				metastring: node.meta,
			};
		}
	});
};

const remarkPlugins: PluggableList = [
	RemarkBreaks,
	RemarkGfm,
	RemarkDirective,
	[RemarkMath, { singleDollarTextMath: false }],
	createDirectives,
	createCodeMeta,
];

const createNewlines = () => (tree: Root) => {
	visit(tree, "text", (node, index, parent) => {
		if (node.value.trim() === "" && parent && index != null) {
			parent.children.splice(index, 1);
			return index; // revisit same index since we spliced
		}
	});
};

const rehypePlugins: PluggableList = [
	RehypeRaw,
	[
		RehypeSanitize,
		{
			tagNames: [
				...(defaultSchema.tagNames ?? []),
				...Object.keys(allowedTags),
			],
			attributes: { ...defaultSchema.attributes, ...allowedTags },
		},
	],
	createNewlines,
];

const rehypePluginsWithKatex: PluggableList = [...rehypePlugins, RehypeKatex];

const processor = unified()
	.use(RemarkParse)
	.use(remarkPlugins)
	.use(RemarkRehype, { allowDangerousHtml: true })
	.use(rehypePlugins);

export const useMarkdown = ({
	source,
	withRemend,
	withKatex,
}: {
	source: string;
	withRemend?: boolean;
	withKatex?: boolean;
}) => {
	const content = useMemo(() => {
		const content = source.replace(/<cite([/ ])/g, "<mark$1");
		return withRemend ? remend(content) : content;
	}, [source, withRemend]);

	return {
		remarkPlugins,
		rehypePlugins: withKatex ? rehypePluginsWithKatex : rehypePlugins,
		allowedTags,
		processor,
		content,
	};
};
