import { ComponentUtils } from "@tiny-chat/client/src/core/utils/ComponentUtils.ts";
import { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { useMessageStore } from "@tiny-chat/client/src/features/message/stores/useMessageStore.ts";
import { SourceUtils } from "@tiny-chat/client/src/features/message/utils/SourceUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { ExtraProps } from "hast-util-to-jsx-runtime";
import { useWindowSize } from "ink";
import Image from "ink-picture";
import {
	Children,
	type ComponentType,
	createContext,
	isValidElement,
	type JSX,
	type ReactNode,
	useContext,
} from "react";
import Anchor from "../../../core/components/Anchor.tsx";
import Box from "../../../core/components/Box.tsx";
import Divider from "../../../core/components/Divider.tsx";
import Text, { type TextProps } from "../../../core/components/Text.tsx";
import { CliUtils } from "../../../core/utils/CliUtils.ts";
import { Code } from "../../code/components/Code.tsx";
import {
	TableComponent,
	TbodyComponent,
	TdComponent,
	ThComponent,
	TheadComponent,
	TrComponent,
} from "./MarkdownTable.tsx";

type Components = {
	[TagName in keyof JSX.IntrinsicElements]:
		| ComponentType<JSX.IntrinsicElements[TagName] & ExtraProps>
		| keyof JSX.IntrinsicElements;
};

/**
 * Wraps mixed inline/block children for Ink. If all children are inline,
 * renders a single <Text>. If any are block-level, splits into groups:
 * consecutive inline nodes get wrapped in <Text>, block nodes pass through.
 *
 * `gap` spaces those groups apart. It stays 0 for content that flows as one
 * paragraph and is only raised where the children really are separate blocks.
 */
function BaseComponent({
	children,
	gap = 0,
	text,
}: {
	children?: ReactNode;
	gap?: number;
	text?: TextProps;
}) {
	const context = useContext(MarkdownContext);

	const childArray = Children.toArray(children).map((child) =>
		typeof child === "string" ? CliUtils.display(child) : child,
	);
	if (childArray.length === 0) return null;

	if (childArray.every((c) => !isBlockNode(c))) {
		return (
			<Text color={context.style?.textColor} {...text}>
				{childArray}
			</Text>
		);
	}

	const groups: ReactNode[] = [];
	let inlineBuffer: ReactNode[] = [];
	let key = 0;

	const flush = () => {
		if (inlineBuffer.length > 0) {
			groups.push(
				<Text key={key++} color={context.style?.textColor} {...text}>
					{inlineBuffer}
				</Text>,
			);
			inlineBuffer = [];
		}
	};

	for (const child of childArray) {
		if (isBlockNode(child)) {
			flush();
			groups.push(child);
		} else {
			inlineBuffer.push(child);
		}
	}
	flush();

	return (
		<Box flexDirection="column" gap={gap}>
			{groups}
		</Box>
	);
}

const PComponent: Components["p"] = ({ children }) => (
	<BaseComponent>{children}</BaseComponent>
);

const EmComponent: Components["em"] = ({ children }) => (
	<Text italic>{children}</Text>
);

const StrongComponent: Components["strong"] = ({ children }) => (
	<Text bold>{children}</Text>
);

const DelComponent: Components["del"] = ({ children }) => (
	<Text strikethrough>{children}</Text>
);

const H1Component: Components["h1"] = ({ children }) => (
	<Box flexDirection="column">
		<BaseComponent text={{ bold: true }}>{children}</BaseComponent>
		<HrComponent />
	</Box>
);

const H2Component: Components["h2"] = ({ children }) => (
	<BaseComponent text={{ bold: true }}>{children}</BaseComponent>
);

const H3Component: Components["h3"] = H2Component;

const H4Component: Components["h4"] = ({ children }) => (
	<BaseComponent>{children}</BaseComponent>
);

const H5Component: Components["h5"] = H4Component;

const H6Component: Components["h6"] = H4Component;

const ImgComponent: Components["img"] = ({ src, alt }) => {
	const { rows } = useWindowSize();
	return (
		<Image
			src={src ?? ""}
			alt={alt ?? ""}
			height={rows - 2}
			objectFit="contain"
		/>
	);
};

const AComponent: Components["a"] = ({ href, children }) => (
	<Anchor href={href}>{children}</Anchor>
);

const CodeBlockContext = createContext(false);

const PreComponent: Components["pre"] = ({ children }) => (
	<CodeBlockContext value={true}>{children}</CodeBlockContext>
);

const CodeComponent: Components["code"] = ({ children, className }) => {
	const { rows } = useWindowSize();

	const code = ComponentUtils.text({ children });
	const language = className?.replace("language-", "");
	const isBlock = useContext(CodeBlockContext);

	if (language === "math") {
		return (
			<Box>
				<Image
					src={`https://latex.codecogs.com/png.latex?\\fg{white}${encodeURIComponent(code)}`}
					alt={children as string}
					height={rows - 2}
					objectFit="contain"
					protocol="braille"
				/>
			</Box>
		);
	}

	if (isBlock) {
		return <Code code={code} language={language} filename={language} />;
	}

	return (
		<Text color="textSubtle" backgroundColor="interior">
			{CliUtils.display(code)}
		</Text>
	);
};

const ListContext = createContext<{
	depth: number;
	number?: number;
	loose?: boolean;
}>({ depth: 0 });

type HastElement = NonNullable<ExtraProps["node"]>;

/**
 * A list is loose when markdown wrapped its items' content in paragraphs —
 * the same signal CommonMark uses to decide whether items get spaced apart.
 */
function isLooseList(node?: HastElement) {
	return (
		node?.children.some(
			(item) =>
				item.type === "element" &&
				item.tagName === "li" &&
				item.children.some(
					(child) => child.type === "element" && child.tagName === "p",
				),
		) ?? false
	);
}

const UlComponent: Components["ul"] = ({ children, node }) => {
	const { depth } = useContext(ListContext);
	const loose = isLooseList(node);

	return (
		<Box paddingLeft={2} flexDirection="column" gap={1}>
			{Children.map(children, (child) => (
				<ListContext value={{ depth: depth + 1, loose }}>{child}</ListContext>
			))}
		</Box>
	);
};

const OlComponent: Components["ol"] = ({ children, node }) => {
	const { depth } = useContext(ListContext);
	const loose = isLooseList(node);

	return (
		<Box paddingLeft={2} flexDirection="column" gap={1}>
			{Children.map(children, (child, index) => (
				<ListContext value={{ depth: depth + 1, number: index + 1, loose }}>
					{child}
				</ListContext>
			))}
		</Box>
	);
};

const UL_GLYPHS = ["●", "○", "▪", "▫"];

const LiComponent: Components["li"] = ({ children }) => {
	const { depth, number, loose } = useContext(ListContext);
	const glyph = number
		? `${number}.`
		: UL_GLYPHS[(depth - 1) % UL_GLYPHS.length];

	return (
		<Box>
			<Text>{glyph} </Text>
			<Box flexGrow={1} flexDirection="column">
				<BaseComponent gap={loose ? 1 : 0}>{children}</BaseComponent>
			</Box>
		</Box>
	);
};

const InputComponent: Components["input"] = ({ type, checked }) =>
	type === "checkbox" && (
		<Text color={checked ? "green" : "gray"}>{checked ? "✔" : "□"}</Text>
	);

const HrComponent: Components["hr"] = () => {
	return <Divider />;
};

const BrComponent: Components["br"] = () => <Text>{"\n"}</Text>;

const BlockquoteComponent: Components["blockquote"] = ({ children, node }) => (
	<Box paddingLeft={2} flexDirection="column">
		{!!node?.properties?.model && (
			<Text bold>💬 {node.properties.model as string}</Text>
		)}
		<Box flexDirection="column" gap={1}>
			{children}
		</Box>
	</Box>
);

const SubComponent: Components["sub"] = ({ children }) => (
	<Text>
		<Text dimColor>_</Text>
		{children}
	</Text>
);

const SupComponent: Components["sup"] = ({ children }) => (
	<Text>
		<Text dimColor>^</Text>
		{children}
	</Text>
);

const SectionComponent: Components["section"] = ({ children }) => (
	<Text>
		<Text dimColor>§</Text>
		{children}
	</Text>
);

const SlotComponent: Components["slot"] = ({ children, ...props }) => {
	return (
		<Text color="primary" backgroundColor="interior">
			<Text>
				/{(props as { name?: string }).name?.replace("user-content-", "")}
			</Text>
			{Children.count(children) > 0 && (
				<Text>
					{` `}
					{children}
				</Text>
			)}
		</Text>
	);
};

const LinkComponent: Components["link"] = ({ children, ...props }) => {
	return (
		<Text color="primary" backgroundColor="interior">
			@{PathUtils.name((props as { source?: string }).source ?? "?")}
		</Text>
	);
};

const MarkComponent: Components["mark"] = ({ children, node }) => {
	// Read per-citation rather than through the markdown context: sources change
	// whenever a chat-scoped query settles, and only this component cares.
	const sources = useMessageStore((s) => s.sources);

	const keys = ((node?.properties.sources ?? "") as string)
		.replace("user-content-", "")
		.split(/[\s;,]+/);

	return (
		<Text>
			{children}
			{keys.map((key) => {
				const text = ComponentUtils.text({ children });
				const source = SourceUtils.getDisplay({ sources, key, text });
				return (
					<>
						{` ${source.emoji} `}
						<Anchor
							key={key}
							href={source.type === "web" ? source.value.url : undefined}
							color="textSubtle"
						>
							{source.title.slice(0, 50)}
							{source.title.length > 50 ? "…" : ""}
						</Anchor>
					</>
				);
			})}
		</Text>
	);
};

// --- Inline/block detection ---

const BLOCK_NODES: Set<unknown> = new Set([
	PComponent,
	ImgComponent,
	PreComponent,
	UlComponent,
	OlComponent,
	HrComponent,
	BlockquoteComponent,
	TableComponent,
	TheadComponent,
	TbodyComponent,
	TrComponent,
	TdComponent,
	ThComponent,
]);

function isBlockNode(node: ReactNode): boolean {
	if (!isValidElement(node)) return false;
	if (node.type === Box) return true;
	if (BLOCK_NODES.has(node.type)) return true;
	return (
		node.type === CodeComponent &&
		(node.props as { className?: string }).className === "language-math"
	);
}

// --- Export ---

export const MarkdownComponents: Partial<Components> = {
	table: TableComponent,
	thead: TheadComponent,
	tbody: TbodyComponent,
	tr: TrComponent,
	th: ThComponent,
	td: TdComponent,
	sup: SupComponent,
	sub: SubComponent,
	section: SectionComponent,
	p: PComponent,
	em: EmComponent,
	strong: StrongComponent,
	del: DelComponent,
	h1: H1Component,
	h2: H2Component,
	h3: H3Component,
	h4: H4Component,
	h5: H5Component,
	h6: H6Component,
	hr: HrComponent,
	br: BrComponent,
	blockquote: BlockquoteComponent,
	pre: PreComponent,
	code: CodeComponent,
	img: ImgComponent,
	a: AComponent,
	ul: UlComponent,
	ol: OlComponent,
	li: LiComponent,
	input: InputComponent,
	slot: SlotComponent,
	link: LinkComponent,
	mark: MarkComponent,
};
