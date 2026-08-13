/** biome-ignore-all lint/suspicious/noArrayIndexKey: code stays in order */

import { Text } from "@mantine/core";
import type { CodeResult } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { memo, type ReactNode, useMemo } from "react";

const HighlightContent = memo(
	({
		code,
		children,
		language,
		filename,
		startLine = 1,
		lineNumbers = true,
	}: {
		code: CodeResult;
		children?: ReactNode;
		language: string;
		filename?: string;
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
				className="overflow-x-auto rounded-md border border-(--mantine-color-default-border) p-4 text-sm"
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
						{filename && (
							<Text
								c="muted"
								size="xs"
								pl={10}
								pr={75}
								pt={5}
								pb={10}
								truncate="end"
							>
								{filename}
							</Text>
						)}
						{children}
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
export default HighlightContent;
