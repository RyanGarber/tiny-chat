import type { Root as HastRoot } from "hast";
import type { Code, Root as MdastRoot, Nodes } from "mdast";
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
import { type PluggableList, type Processor, unified } from "unified";
import { visit } from "unist-util-visit";

export type * from "mdast";
export type * from "mdast-util-to-hast";

const allowedTags: Partial<Record<keyof JSX.IntrinsicElements, string[]>> = {
	blockquote: ["model"],
	mark: ["sources"],
	link: ["source", "is-directory"],
	slot: ["name", "value", "accepts-content", "needs-run"],
	details: ["lines"],
};

type DirectiveKind = "text" | "leaf" | "container";

type MicromarkToken = { type: string };

type MicromarkConstruct = {
	tokenize: (
		this: {
			events: Array<["enter" | "exit", MicromarkToken, ...unknown[]]>;
			sliceSerialize: (token: MicromarkToken) => string;
		},
		effects: unknown,
		ok: (code: number | null) => unknown,
		nok: (code: number | null) => unknown,
	) => unknown;
	previous?: unknown;
	concrete?: boolean;
};

type MicromarkDirectiveExtension = {
	text?: { 58?: MicromarkConstruct };
	flow?: { 58?: MicromarkConstruct | MicromarkConstruct[] };
};

/**
 * remark-directive's default tokenizer is greedy: `:1` is a text directive and
 * `::1` is a leaf, which turns ratios, emphasis like `*1:1*`, and IPv6 `::1`
 * into nodes. That disagrees with DirectiveUtils — text directives need `[]`,
 * and names start with a letter — so reject anything that doesn't match here,
 * at parse time, before it can split a paragraph.
 */
const wrapDirectiveConstruct = (
	construct: MicromarkConstruct,
	kind: DirectiveKind,
): MicromarkConstruct => ({
	...construct,
	tokenize(effects, ok, nok) {
		return construct.tokenize.call(
			this,
			effects,
			(code) => {
				const cap = `${kind[0].toUpperCase()}${kind.slice(1)}`;
				const nameType = `directive${cap}Name`;
				const labelType = `directive${cap}Label`;
				let name = "";
				let hasLabel = false;
				for (const [enter, token] of this.events) {
					if (enter === "exit" && token.type === nameType) {
						name = this.sliceSerialize(token);
					}
					if (enter === "enter" && token.type === labelType) {
						hasLabel = true;
					}
				}
				if (!/^[A-Za-z]/.test(name)) return nok(code);
				if (kind === "text" && !hasLabel) return nok(code);
				return ok(code);
			},
			nok,
		);
	},
});

function restrictDirectiveSyntax(this: Processor) {
	const extensions = (
		this.data() as { micromarkExtensions?: MicromarkDirectiveExtension[] }
	).micromarkExtensions;
	const extension = extensions?.find(
		(candidate) => candidate.text?.[58] && candidate.flow?.[58],
	);
	if (!extension?.text?.[58] || !extension.flow?.[58]) return;

	extension.text[58] = wrapDirectiveConstruct(extension.text[58], "text");
	const flow = Array.isArray(extension.flow[58])
		? extension.flow[58]
		: [extension.flow[58]];
	extension.flow[58] = [
		wrapDirectiveConstruct(flow[0], "container"),
		wrapDirectiveConstruct(flow[1], "leaf"),
	];
}

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

	return (tree: MdastRoot) => {
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
			if (node.name === "paste") toNode(node, "details");
		});
	};
};

const createCodeMeta = () => (tree: MdastRoot) => {
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
	restrictDirectiveSyntax,
	[RemarkMath, { singleDollarTextMath: false }],
	createDirectives,
	createCodeMeta,
];

/**
 * Drops the whitespace mdast-util-to-hast inserts between block elements,
 * which renderers that lay blocks out themselves have no way to render.
 *
 * The marker is the newline: structural whitespace always has one, and text
 * that flows never does, since remark-breaks turns soft breaks into `<br>`.
 * That distinction matters twice over — rehype-raw's reparse merges adjacent
 * text nodes, so a structural newline can end up inside `"item text\n"`
 * rather than in a whitespace-only node of its own, while the joining space
 * between two inline spans *is* its own whitespace-only node and has to
 * survive, or `**a** *b*` renders as `**a***b*`.
 */
const createNewlines = () => (tree: HastRoot) => {
	visit(tree, "text", (node, index, parent) => {
		if (!parent || index == null) return;
		// Text inside these is content, so its newlines are load-bearing.
		if (parent.type === "element" && ["pre", "code"].includes(parent.tagName))
			return;

		node.value = node.value.replace(/\n[ \t]*/g, "");

		if (node.value === "") {
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

export const processor = unified()
	.use(RemarkParse)
	.use(remarkPlugins)
	.use(RemarkRehype, { allowDangerousHtml: true })
	.use(rehypePlugins);

/**
 * The agent's own `<message role=… model=…>` wrapper, which is transport rather
 * than content.
 *
 * It has to come off before parsing. It is not in `allowedTags`, so rehype
 * sanitizes it away in the end regardless — but while it is still there remark
 * reads it as an HTML block, which swallows everything up to the first blank
 * line (a leading heading renders as literal `## text`). Worse during a stream:
 * until the closing tag arrives the tag is unbalanced, and a block splitter has
 * to treat the whole document as one block, which is exactly the incremental
 * rendering the split is meant to enable.
 */
const MESSAGE_OPEN = /^\s*<message[^>]*>\n?/;
const MESSAGE_CLOSE = /\n?<\/message>\s*$/;

export const useMarkdown = ({
	source,
	withKatex,
}: {
	source: string;
	withKatex?: boolean;
}) => {
	const content = useMemo(
		() =>
			source
				.replace(MESSAGE_OPEN, "")
				.replace(MESSAGE_CLOSE, "")
				.replace(/<cite([/ ])/g, "<mark$1"),
		[source],
	);

	return {
		remarkPlugins,
		rehypePlugins: withKatex ? rehypePluginsWithKatex : rehypePlugins,
		allowedTags,
		processor,
		content,
	};
};
