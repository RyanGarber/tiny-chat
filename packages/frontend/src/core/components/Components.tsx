import { Icon } from "@iconify/react";
import { Group, Text } from "@mantine/core";
import type { HighlightResult } from "@streamdown/code";
import { type ComponentProps, memo, type ReactNode, useMemo } from "react";
import ReactDiffViewer, {
	type ReactDiffViewerStylesOverride,
} from "react-diff-viewer-continued";
import {
	type BundledLanguage,
	CodeBlockContainer,
	CodeBlockCopyButton,
	CodeBlockDownloadButton,
	CodeBlockHeader,
} from "streamdown";
import { useLayoutStore } from "#frontend/core/stores/useLayoutStore.tsx";
import { useThemes } from "#frontend/features/settings/hooks/useThemes.ts";
import { highlight, toCSSProperties } from "#frontend/utils/ui.tsx";

const CodeBlockContent = ({
	result,
	lineNumbers,
}: {
	result: HighlightResult;
	lineNumbers: boolean;
}) => {
	return result.tokens.map((row) => (
		<span
			className={
				lineNumbers
					? "block before:content-[counter(line)] before:inline-block before:[counter-increment:line] before:w-6 before:mr-4 before:text-[13px] before:text-right before:text-muted-foreground/50 before:font-mono before:select-none"
					: undefined
			}
			key={row.map((token) => token.content).join(",")}
		>
			{row.length === 0 || (row.length === 1 && row[0].content === "")
				? "\n"
				: row.map((token) => {
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
								className={`text-(--sdm-c,inherit) dark:text-(--shiki-dark,var(--sdm-c,inherit)) ${hasBg ? "bg-(--sdm-tbg) dark:bg-(--shiki-dark-bg,var(--sdm-tbg))" : ""}`}
								key={token.content}
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
		result,
		language,
		startLine = 1,
		lineNumbers = true,
	}: {
		result: ReturnType<typeof highlight>;
		language: string;
		startLine?: number;
		lineNumbers?: boolean;
	}) => {
		const preStyle = useMemo(() => {
			const style: Record<string, string> = {};

			if (result.bg) {
				style["--sdm-bg"] = result.bg;
			}
			if (result.fg) {
				style["--sdm-fg"] = result.fg;
			}

			if (result.rootStyle) {
				Object.assign(style, toCSSProperties(result.rootStyle));
			}

			return style;
		}, [result.bg, result.fg, result.rootStyle]);

		return (
			<div
				className="overflow-x-auto rounded-md border border-border bg-background p-4 text-sm"
				data-language={language}
				data-streamdown="code-block-body"
			>
				<pre
					className="bg-[var(--sdm-bg),inherit] dark:bg-(--shiki-dark-bg,var(--sdm-bg,inherit))"
					style={preStyle}
				>
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
						<CodeBlockContent result={result} lineNumbers={lineNumbers} />
					</code>
				</pre>
			</div>
		);
	},
	(prev, next) =>
		prev.result === next.result &&
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
	language: BundledLanguage;
	code: string;
	startLine?: number;
	lineNumbers?: boolean;
}) => {
	const { codeTheme } = useThemes();
	const result = highlight(language, codeTheme.data, code);
	return (
		<CodeBlockContainer language={language} style={{ marginTop: 0 }}>
			<CodeBlockHeader language={filename ?? language} />
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
				result={result}
				language={language}
				lineNumbers={lineNumbers}
				startLine={startLine}
			/>
		</CodeBlockContainer>
	);
};

export const Diff = ({
	filename,
	language,
	oldCode,
	newCode,
}: {
	filename?: string;
	language: BundledLanguage;
	oldCode: string;
	newCode: string;
}) => {
	const { theme, codeTheme } = useThemes();
	const isMobile = useLayoutStore((s) => s.isMobile);

	const result = highlight(language, codeTheme.data, "");
	const styles: ReactDiffViewerStylesOverride | undefined = result
		? {
				variables: {
					light: {
						diffViewerTitleBackground: result?.bg,
						diffViewerTitleColor: result?.fg,
						diffViewerBackground: result?.bg,
						diffViewerColor: result?.fg,
						gutterColor: result?.fg,
						emptyLineBackground: result?.bg,
						wordAddedBackground: "rgba(0, 0, 0, 0.1)",
						wordRemovedBackground: "rgba(0, 0, 0, 0.1)",
					},
					dark: {
						diffViewerTitleBackground: result?.bg,
						diffViewerTitleColor: result?.fg,
						diffViewerBackground: result?.bg,
						diffViewerColor: result?.fg,
						gutterColor: result?.fg,
						emptyLineBackground: result?.bg,
						wordAddedBackground: "rgba(100, 255, 100, 0.1)",
						wordRemovedBackground: "rgba(255, 100, 100, 0.1)",
					},
				},
			}
		: undefined;

	return (
		<CodeBlockContainer language="diff" style={{ marginTop: 0 }}>
			<CodeBlockHeader language={filename ?? language} />
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
					<CodeBlockCopyButton code={newCode} />
					<CodeBlockDownloadButton code={newCode} language={language} />
				</div>
			</div>
			<ReactDiffViewer
				oldValue={oldCode}
				newValue={newCode}
				splitView={!isMobile}
				useDarkTheme={theme.data === "dark"}
				renderContent={(code) => (
					<CodeBlockContent
						result={highlight(language, codeTheme.data, code)}
						lineNumbers={false}
					/>
				)}
				hideLineNumbers={true}
				disableWordDiff={true}
				styles={styles}
			/>
		</CodeBlockContainer>
	);
};

export const Blockquote = ({
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
