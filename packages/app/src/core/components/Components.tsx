import { Icon } from "@iconify/react";
import { Box, Button, Group, Image, Text } from "@mantine/core";
import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { DiffUtils } from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import { PathUtils } from "@tiny-chat/core/src/features/file/utils/PathUtils.ts";
import {
	type ComponentProps,
	type Dispatch,
	memo,
	type ReactNode,
	type SetStateAction,
	useMemo,
	useState,
} from "react";
import {
	CodeBlockContainer,
	CodeBlockCopyButton,
	CodeBlockDownloadButton,
	CodeBlockHeader,
} from "streamdown";
import { theme } from "#app/core/utils/IconUtils.ts";
import type { CodeLanguage, CodeResult } from "#core/core/utils/CodeUtils.ts";

const CodeBlockContent = ({
	code,
	language,
	lineNumbers,
}: {
	code: string | CodeResult;
	language?: string | null;
	lineNumbers: boolean;
}) => {
	const { highlighted } = useCode({ code, language });

	return highlighted.tokens.map((row, i) => (
		<span
			className={
				lineNumbers
					? "block before:content-[counter(line)] before:inline-block before:[counter-increment:line] before:w-6 before:mr-4 before:text-[13px] before:text-right before:text-muted-foreground/50 before:font-mono before:select-none"
					: undefined
			}
			// biome-ignore lint/suspicious/noArrayIndexKey: repeats
			key={i}
		>
			{row.length === 0 || (row.length === 1 && row[0].content === "")
				? "\n"
				: row.map((token, j) => {
						const tokenStyle: Record<string, string> = {};
						let hasBg = Boolean(token.bgColor);

						if (token.color) {
							tokenStyle["--sdm-c"] = token.color;
						}
						if (token.bgColor) {
							tokenStyle["--sdm-tbg"] = token.bgColor;
						}

						if (token.htmlStyle) {
							for (const [key, value] of Object.entries(token.htmlStyle)) {
								if (key === "color") {
									tokenStyle["--sdm-c"] = value;
								} else if (key === "background-color") {
									tokenStyle["--sdm-tbg"] = value;
									hasBg = true;
								} else {
									tokenStyle[key] = value;
								}
							}
						}

						return (
							<span
								className={`text-(--sdm-c,inherit) ${hasBg ? "bg-(--sdm-tbg)" : ""}`}
								// biome-ignore lint/suspicious/noArrayIndexKey: repeats
								key={j}
								style={tokenStyle}
								{...token.htmlAttrs}
							>
								{token.content}
							</span>
						);
					})}
		</span>
	));
};

const CodeBlockBody = memo(
	({
		code,
		children,
		language,
		startLine = 1,
		lineNumbers = true,
	}: {
		code: CodeResult;
		children?: ReactNode;
		language: string;
		startLine?: number;
		lineNumbers?: boolean;
	}) => {
		const preStyle = useMemo(() => {
			const style: Record<string, string> = {};

			if (code.bg) {
				style["--sdm-bg"] = code.bg;
			}
			if (code.fg) {
				style["--sdm-fg"] = code.fg;
			}

			if (code.rootStyle) {
				Object.assign(style, CommonUtils.toStyleObject(code.rootStyle));
			}

			return style;
		}, [code.bg, code.fg, code.rootStyle]);

		return (
			<div
				className="overflow-x-auto rounded-md border border-border bg-background p-4 text-sm"
				data-language={language}
				data-streamdown="code-block-body"
			>
				<pre className="bg-[var(--sdm-bg),inherit]" style={preStyle}>
					<code
						className={
							lineNumbers
								? "[counter-increment:line_0] [counter-reset:line]"
								: undefined
						}
						style={
							lineNumbers && startLine && startLine > 1
								? { counterReset: `line ${startLine - 1}` }
								: undefined
						}
					>
						{children ?? (
							<CodeBlockContent code={code} lineNumbers={lineNumbers} />
						)}
					</code>
				</pre>
			</div>
		);
	},
	(prev, next) =>
		prev.code === next.code &&
		prev.language === next.language &&
		prev.startLine === next.startLine &&
		prev.lineNumbers === next.lineNumbers,
);

export const Code = ({
	filename,
	language,
	code,
	startLine = 1,
	lineNumbers = true,
}: {
	filename?: string;
	language?: CodeLanguage;
	code: string;
	startLine?: number;
	lineNumbers?: boolean;
}) => {
	const { highlighted } = useCode({ code, language });

	return (
		<CodeBlockContainer language={language ?? ""} style={{ marginTop: 0 }}>
			<CodeBlockHeader language={filename ?? language ?? ""} />
			<div
				className={
					"pointer-events-none sticky top-2 z-10 -mt-10 flex h-8 items-center justify-end"
				}
			>
				<div
					className={
						"pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/80 px-1.5 py-1 supports-backdrop-filter:bg-sidebar/70 supports-backdrop-filter:backdrop-blur"
					}
					data-streamdown="code-block-actions"
				>
					<CodeBlockCopyButton code={code} />
					<CodeBlockDownloadButton code={code} language={language} />
				</div>
			</div>
			<CodeBlockBody
				language={language ?? ""}
				lineNumbers={lineNumbers}
				startLine={startLine}
				code={highlighted}
			/>
		</CodeBlockContainer>
	);
};

const bg = (type: ReturnType<typeof DiffUtils.context>[number]["type"]) => {
	switch (type) {
		case "added":
			return "rgba(0, 255, 0, 0.1)";
		case "removed":
			return "rgba(255, 0, 0, 0.1)";
		default:
			return undefined;
	}
};

const Line = ({
	children,
	type,
	expanded,
}: {
	children: ReactNode;
	type: ReturnType<typeof DiffUtils.context>[number]["type"];
	expanded?: boolean;
}) => {
	return (
		<Group
			gap={0}
			align="flex-start"
			wrap="nowrap"
			miw="100%"
			bg={bg(type)}
			p={2}
		>
			{(type !== "unchanged" || expanded) && (
				<Box
					w={20}
					miw={20}
					h={20}
					fz="sm"
					c="dimmed"
					style={{ textAlign: "center" }}
				>
					{type === "removed" && "-"}
					{type === "added" && "+"}
					{type === "changed" && "~"}
				</Box>
			)}
			{children}
		</Group>
	);
};

// biome-ignore-start lint/suspicious/noArrayIndexKey: lines stay in order
const Lines = ({
	diff,
	expanded,
	setExpanded,
	language,
}: {
	diff: ReturnType<typeof DiffUtils.context>;
	expanded: number[];
	setExpanded: Dispatch<SetStateAction<number[]>>;
	language: string;
}) => {
	return diff.flatMap((change, index) => (
		<Box key={index}>
			{change.type === "unchanged" &&
				expanded.includes(index) &&
				change.lines.map((line, lineIndex) => (
					<Line key={lineIndex} type={change.type} expanded>
						<Box flex={1}>
							<CodeBlockContent
								code={line}
								language={language}
								lineNumbers={false}
							/>
						</Box>
					</Line>
				))}
			{(change.type !== "unchanged" || !expanded.includes(index)) && (
				<Line key={index} type={change.type}>
					{change.type === "unchanged" && (
						<Button
							variant="transparent"
							bg="rgba(0, 0, 0, 0.1)"
							flex={1}
							size="xs"
							onClick={() => setExpanded((previous) => [...previous, index])}
						>
							{change.lines.length} unchanged line
							{change.lines.length === 1 ? "" : "s"}
						</Button>
					)}
					{change.type !== "unchanged" && (
						<Box flex={1}>
							{change.type === "changed" &&
								change.parts.map((part, partIndex) => (
									<span key={partIndex}>
										{part.type === "changed" && (
											<span style={{ backgroundColor: bg(part.type) }}>
												<span
													style={{
														backgroundColor: bg("removed"),
														padding: "2px 4px",
													}}
												>
													{part.partBefore}
												</span>
												<span
													style={{
														backgroundColor: bg("added"),
														padding: "2px 4px",
													}}
												>
													{part.partAfter}
												</span>
											</span>
										)}
										{part.type !== "changed" && (
											<span
												style={{
													backgroundColor: bg(part.type),
													padding: "2px 0",
												}}
											>
												{part.part}
											</span>
										)}
									</span>
								))}
							{change.type !== "changed" && (
								<CodeBlockContent
									code={change.line}
									language={language}
									lineNumbers={false}
								/>
							)}
						</Box>
					)}
				</Line>
			)}
		</Box>
	));
};
// biome-ignore-end lint/suspicious/noArrayIndexKey: lines stay in order

export const Diff = ({
	filename,
	language,
	before,
	after,
}: {
	filename?: string;
	language?: CodeLanguage;
	before: string;
	after: string;
}) => {
	const [expanded, setExpanded] = useState<number[]>([]);

	const { highlighted: baseHighlight } = useCode({ code: "", language });

	const diff = useMemo(
		() => DiffUtils.context(DiffUtils.diff({ before, after })),
		[before, after],
	);

	return (
		<CodeBlockContainer language="diff" style={{ marginTop: 0 }}>
			<CodeBlockHeader language={filename ?? language ?? ""} />
			<div
				className={
					"pointer-events-none sticky top-2 z-10 -mt-10 flex h-8 items-center justify-end"
				}
			>
				<div
					className={
						"pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/80 px-1.5 py-1 supports-backdrop-filter:bg-sidebar/70 supports-backdrop-filter:backdrop-blur"
					}
					data-streamdown="code-block-actions"
				>
					<CodeBlockCopyButton code={after} />
					<CodeBlockDownloadButton code={after} language={language} />
				</div>
			</div>

			<CodeBlockBody code={baseHighlight} language={language ?? ""}>
				<Lines
					diff={diff}
					expanded={expanded}
					setExpanded={setExpanded}
					language={language ?? ""}
				/>
			</CodeBlockBody>
		</CodeBlockContainer>
	);
};

export const Quote = ({
	model,
	children,
	...props
}: ComponentProps<"blockquote"> & { model?: string; children: ReactNode }) => {
	return (
		<blockquote
			className="my-4 border-muted-foreground/30 border-l-4 pl-4 text-muted-foreground italic"
			data-streamdown="blockquote"
			{...props}
		>
			{model && (
				<Group gap={5} c="dimmed" mb={4}>
					<Icon
						icon="lucide:message-square-quote"
						height={14}
						style={{ transform: "scale(-1,1)" }}
					/>
					<Text size="xs">{model}</Text>
				</Group>
			)}
			{children}
		</blockquote>
	);
};

export const Attachment = ({
	source,
	directory,
	grabbable,
}: {
	source: string;
	directory?: boolean;
	grabbable?: boolean;
}) => {
	const iconId = !directory
		? theme?.getFileIconId(source, undefined, false)
		: theme?.getFolderIconId(source, false, false);
	const icon = iconId ? theme?.getIconContent(iconId, "base64") : null;

	const web = !!PathUtils.hostname(source);

	return (
		<span
			className={`inline-flex items-center gap-1 text-sm! font-medium rounded-xl px-2 bg-(--mantine-color-default-hover) ${grabbable ? "cursor-grab" : "cursor-default"}`}
		>
			{web ? (
				<Icon icon="lucide:link" />
			) : (
				icon && (
					<Image
						src={`data:${icon.mimeType};base64,${icon.data}`}
						alt={PathUtils.name(source)}
						w="auto"
						h={20}
						mt={-5}
						pt={5}
					/>
				)
			)}{" "}
			<span className={`py-1`}>
				{PathUtils.name(source)}
				{directory ? "/" : ""}
			</span>
		</span>
	);
};

export const Command = ({
	name,
	content,
}: {
	name: string;
	content?: ReactNode;
}) => {
	return (
		<span className="inline-flex items-center gap-1 rounded-xl bg-muted cursor-default">
			<span className="px-2 py-1 text-sm! font-medium" contentEditable={false}>
				/{name}
			</span>
			{content && (
				<span className="rounded-xl px-2 py-1 text-sm cursor-text bg-(--tc-surface) border border-(--tc-interior) min-w-1 min-h-7">
					{content}
				</span>
			)}
		</span>
	);
};
