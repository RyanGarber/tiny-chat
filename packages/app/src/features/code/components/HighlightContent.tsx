/** biome-ignore-all lint/suspicious/noArrayIndexKey: code stays in order */

import { Text } from "@mantine/core";
import type { CodeResult } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { CommonUtils } from "@tiny-chat/core/src/core/utils/CommonUtils.ts";
import { type ReactNode, useMemo } from "react";

export default function HighlightContent({
	highlight,
	children,
	language,
	filename,
	startLine = 1,
	lineNumbers = true,
	fillHeight = false,
}: {
	highlight: CodeResult;
	children?: ReactNode;
	language: string;
	filename?: string;
	startLine?: number;
	lineNumbers?: boolean;
	fillHeight?: boolean;
}) {
	const preStyle = useMemo(() => {
		const style: Record<string, string> = {};

		if (highlight.bg) {
			style["--sdm-bg"] = highlight.bg;
		}
		if (highlight.fg) {
			style["--sdm-fg"] = highlight.fg;
		}

		if (highlight.rootStyle) {
			Object.assign(style, CommonUtils.toStyleObject(highlight.rootStyle));
		}

		return style;
	}, [highlight.bg, highlight.fg, highlight.rootStyle]);

	return (
		<div
			className={`${fillHeight ? "h-full overflow-auto" : "overflow-x-auto"} rounded-md border border-(--mantine-color-default-border) p-4 text-sm`}
			data-language={language}
			data-streamdown="code-block-body"
			style={{ backgroundColor: highlight?.bg?.split(";")[0] }}
		>
			<pre className="bg-(--sdm-bg)" style={preStyle}>
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
}
