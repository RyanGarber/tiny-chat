import { Anchor, Box, Pill, Stack, Text } from "@mantine/core";
import { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import { useMessageStore } from "@tiny-chat/client/src/features/message/stores/useMessageStore.ts";
import { ComponentUtils } from "@tiny-chat/client/src/features/message/utils/ComponentUtils";
import type { CodeLanguage } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { SourceUtils } from "@tiny-chat/core/src/features/data/utils/SourceUtils.ts";
import { createContext, useContext } from "react";
import type { Components } from "streamdown";
import Popup from "#app/core/components/Popup.tsx";
import { StyleUtils } from "#app/core/utils/StyleUtils.ts";
import Code from "#app/features/code/components/Code.tsx";
import Mermaid from "#app/features/code/components/Mermaid.tsx";
import { Table } from "#app/features/message/components/MarkdownTable.tsx";
import Attachment from "#app/features/part/components/Attachment.tsx";
import Command from "#app/features/part/components/Command.tsx";
import Paste from "#app/features/part/components/Paste.tsx";
import Quote from "#app/features/part/components/Quote.tsx";
import { TauriUtils } from "#app/features/tauri/utils/TauriUtils.ts";
import FileTag from "#app/features/upload/components/FileTag.tsx";

const CodeBlockContext = createContext(false);

const PreComponent: Components["pre"] = ({ children }) => {
	return <CodeBlockContext value={true}>{children}</CodeBlockContext>;
};

const LANGUAGE_REGEX = /language-(\S+)/;
const START_LINE_PATTERN = /startLine=(\d+)/;
const NO_LINE_NUMBERS_PATTERN = /\bnoLineNumbers\b/;

const CodeComponent: Components["code"] = ({
	node,
	className,
	children,
	...props
}) => {
	const inline = !useContext(CodeBlockContext);
	const { streaming } = useContext(MarkdownContext);

	const language = className?.match(LANGUAGE_REGEX)?.[1] ?? "";

	if (inline) {
		return (
			<code
				className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
				data-streamdown="inline-code"
				{...props}
			>
				{children}
			</code>
		);
	}

	const metastring = node?.properties?.metastring as string | undefined;

	const startLineMatch = metastring?.match(START_LINE_PATTERN);
	const parsedStartLine = startLineMatch
		? Number.parseInt(startLineMatch[1], 10)
		: undefined;
	const startLine =
		parsedStartLine !== undefined && parsedStartLine >= 1
			? parsedStartLine
			: undefined;

	const noLineNumbers = metastring
		? NO_LINE_NUMBERS_PATTERN.test(metastring)
		: false;

	const code = ComponentUtils.text({ children });

	if (language === "mermaid") {
		return <Mermaid code={code} streaming={streaming} />;
	}

	return (
		<Code
			code={code}
			language={language as CodeLanguage}
			filename={language}
			startLine={startLine}
			lineNumbers={!noLineNumbers}
			streaming={streaming}
		/>
	);
};

const MarkComponent: Components["mark"] = ({ children, node }) => {
	// Read per-citation rather than through the markdown context: sources change
	// whenever a chat-scoped query settles, and only this component cares.
	const sources = useMessageStore((s) => s.sources);
	const keys = ComponentUtils.props(node, { sources: "" }).sources.split(
		/[\s;,]+/,
	);
	const text = ComponentUtils.text({ children });
	return (
		<span>
			{children}
			{keys.map((key) => {
				const source = SourceUtils.getDisplay({ sources, key, text });
				return (
					<Popup key={key}>
						<Popup.Target>
							<Pill
								size="xs"
								h="auto"
								my={0}
								mx={2}
								py={2}
								px={5.25}
								fz="0.7em"
								display="inline-flex"
								bg="var(--tc-interior)"
								style={{
									cursor: "default",
								}}
							>
								{source.emoji}
							</Pill>
						</Popup.Target>
						<Popup.Dropdown
							style={{ ...StyleUtils.glass, boxShadow: StyleUtils.shadow }}
							c="var(--mantine-color-text)"
						>
							<Stack gap="xs" maw={300}>
								<Text size="sm" fw={500} lineClamp={2}>
									{source.title}
								</Text>
								<Box c="dimmed">
									{source?.type !== "file" && (
										<Text
											textWrap="pretty"
											style={{
												wordBreak: "break-word",
												whiteSpace: "pre-wrap",
											}}
											size="xs"
										>
											{source?.type === "web" && (
												<Anchor
													lineClamp={1}
													href={source.value.url}
													target="_blank"
													onClick={(e) => {
														e.preventDefault();
														void TauriUtils.open(source?.value.url);
													}}
												>
													{source.value.url}
												</Anchor>
											)}
											{source.description}
										</Text>
									)}
									{source?.type === "file" && (
										<FileTag
											path={source.value.path}
											directory={source.value.directory}
										>
											<Text flex={1} miw={0} truncate size="xs">
												{source.description}
											</Text>
										</FileTag>
									)}
								</Box>
							</Stack>
						</Popup.Dropdown>
					</Popup>
				);
			})}
		</span>
	);
};

const BlockquoteComponent: Components["blockquote"] = ({ node, children }) => {
	const { model } = ComponentUtils.props(node, { model: undefined });
	return <Quote model={model}>{children}</Quote>;
};

const AComponent: Components["a"] = ({ href, children }) => {
	return (
		<a
			href={href}
			onClick={(e) => {
				if (!href) return;
				e.preventDefault();
				void TauriUtils.open(href);
			}}
		>
			{children}
		</a>
	);
};

const LinkComponent: Components["link"] = ({ node }) => {
	const {
		source,
		name,
		"is-directory": isDirectory,
	} = ComponentUtils.props(node, {
		source: "?",
		name: undefined,
		"is-directory": false,
	});
	return <Attachment source={source} name={name} directory={isDirectory} />;
};

const SlotComponent: Components["slot"] = ({ node, children }) => {
	const name = ((node?.properties.name ?? "unknown") as string).replace(
		"user-content-",
		"",
	);
	return <Command name={name} content={children} />;
};

const DetailsComponent: Components["details"] = ({ node, children }) => {
	const { lines } = ComponentUtils.props(node, { lines: undefined });
	return <Paste lines={lines}>{children}</Paste>;
};

const TableComponent: Components["table"] = ({ children }) => {
	const { streaming } = useContext(MarkdownContext);
	return (
		<Table withButtons={true} streaming={streaming}>
			{children}
		</Table>
	);
};

export const MarkdownComponents: Components = {
	pre: PreComponent,
	code: CodeComponent,
	mark: MarkComponent,
	blockquote: BlockquoteComponent,
	a: AComponent,
	link: LinkComponent,
	slot: SlotComponent,
	details: DetailsComponent,
	table: TableComponent,
};
