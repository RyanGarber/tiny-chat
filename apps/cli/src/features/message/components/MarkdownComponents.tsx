import { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import type { ExtraProps } from "hast-util-to-jsx-runtime";
import { Box, Text, useWindowSize } from "ink";
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
import { Code } from "../../../core/components/Components.tsx";
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
 */
function BaseComponent({ children }: { children?: ReactNode }) {
	const context = useContext(MarkdownContext);

	const childArray = Children.toArray(children);
	if (childArray.length === 0) return null;

	if (childArray.every((c) => !isBlockNode(c))) {
		return <Text color={context.style?.textColor}>{children}</Text>;
	}

	const groups: ReactNode[] = [];
	let inlineBuffer: ReactNode[] = [];
	let key = 0;

	const flush = () => {
		if (inlineBuffer.length > 0) {
			groups.push(
				<Text key={key++} color={context.style?.textColor}>
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

	return <Box flexDirection="column">{groups}</Box>;
}

const PComponent: Components["p"] = ({ children }) => (
	<BaseComponent>
		{children}
		{`\n`}
	</BaseComponent>
);

const EmComponent: Components["em"] = ({ children }) => (
	<Text italic>{children}</Text>
);

const StrongComponent: Components["strong"] = ({ children }) => (
	<Text bold>{children}</Text>
);

const H1Component: Components["h1"] = ({ children }) => (
	<Box flexDirection="column">
		<Text bold>{children}</Text>
		<HrComponent />
	</Box>
);

const H2Component: Components["h2"] = ({ children }) => (
	<Text bold>
		{children}
		{"\n"}
	</Text>
);

const H3Component: Components["h3"] = H2Component;

const H4Component: Components["h4"] = ({ children }) => (
	<Text>
		{children}
		{"\n"}
	</Text>
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
	<Text color="blueBright">
		{children} ({href})
	</Text>
);

const CodeBlockContext = createContext(false);

const PreComponent: Components["pre"] = ({ children }) => (
	<CodeBlockContext value={true}>
		<Box marginLeft={2}>{children}</Box>
	</CodeBlockContext>
);

const CodeComponent: Components["code"] = ({ children, className }) => {
	const { rows } = useWindowSize();

	const isBlock = useContext(CodeBlockContext);

	let code = "";
	if (
		isValidElement(children) &&
		children.props &&
		typeof children.props === "object" &&
		"children" in children.props &&
		typeof children.props.children === "string"
	) {
		code = children.props.children;
	} else if (typeof children === "string") {
		code = children;
	}

	if (className === "language-math") {
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
		return (
			<Code
				language={className?.replace("language-", "") ?? null}
				code={code}
				marginBottom={1}
			/>
		);
	}

	return <Text color="blue">{children}</Text>;
};

const ListContext = createContext<{ depth: number; number?: number }>({
	depth: 0,
});

const UlComponent: Components["ul"] = ({ children }) => {
	const { depth } = useContext(ListContext);

	return (
		<Box paddingLeft={2} flexDirection="column">
			{Children.map(children, (child) => (
				<ListContext value={{ depth: depth + 1 }}>{child}</ListContext>
			))}
		</Box>
	);
};

const OlComponent: Components["ol"] = ({ children }) => {
	const { depth } = useContext(ListContext);

	return (
		<Box paddingLeft={2} flexDirection="column">
			{Children.map(children, (child, index) => (
				<ListContext value={{ depth: depth + 1, number: index + 1 }}>
					{child}
				</ListContext>
			))}
		</Box>
	);
};

const UL_GLYPHS = ["●", "○", "▪", "▫"];

const LiComponent: Components["li"] = ({ children }) => {
	const childArray = Children.toArray(children);
	const hasBlock = childArray.some(isLiBlockNode);

	const { depth, number } = useContext(ListContext);
	const glyph = number
		? `${number}.`
		: UL_GLYPHS[(depth - 1) % UL_GLYPHS.length];

	if (!hasBlock) {
		return (
			<BaseComponent>
				{glyph} {children}
				{"\n"}
			</BaseComponent>
		);
	}

	return (
		<Box marginBottom={1}>
			<Text>{glyph} </Text>
			<BaseComponent>{children}</BaseComponent>
		</Box>
	);
};

const InputComponent: Components["input"] = ({ type, checked }) =>
	type === "checkbox" && (
		<Text color={checked ? "green" : "gray"}>{checked ? "✔" : "□"}</Text>
	);

const HrComponent: Components["hr"] = () => (
	<Box
		borderStyle="single"
		borderColor="gray"
		borderBottom
		borderTop={false}
		borderLeft={false}
		borderRight={false}
		marginTop={1}
		marginBottom={1}
	></Box>
);

const BrComponent: Components["br"] = () => <Text>{"\n"}</Text>;

const BlockquoteComponent: Components["blockquote"] = ({ children, node }) => (
	<Box paddingLeft={2} flexDirection="column">
		{!!node?.properties?.model && (
			<Text bold>💬 {node.properties.model as string}</Text>
		)}
		{children}
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

const SlotComponent: Components["slot"] = ({ children, ...props }) => (
	<Text backgroundColor="black">
		<Text color="blueBright" bold>
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

const LinkComponent: Components["link"] = ({ children, ...props }) => (
	<Text backgroundColor="black" color="blueBright" bold>
		@{PathUtils.name((props as { source?: string }).source ?? "?")}
	</Text>
);

const MarkComponent: Components["mark"] = ({ children, node }) => (
	<Text>
		{children}
		<Text>{` (${node?.properties?.sources})`}</Text>
	</Text>
);

// --- Inline/block detection ---

const BLOCK_NODES: Set<unknown> = new Set([
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

const LI_BLOCK_NODES: Set<unknown> = new Set([...BLOCK_NODES, PComponent]);
function isLiBlockNode(node: ReactNode): boolean {
	if (!isValidElement(node)) return false;
	if (node.type === Box) return true;
	return LI_BLOCK_NODES.has(node.type);
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
