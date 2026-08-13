/** biome-ignore-all lint/suspicious/noArrayIndexKey: lines stay in order */

import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import type { CodeResult } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import chalk, { type ChalkInstance } from "chalk";
import { Text } from "ink";
import { memo } from "react";

export const CodeLines = memo(
	({
		code,
		language,
		lineNumbers = true,
		startLine = 1,
		chalk: prechalk = chalk,
	}: {
		code: string | CodeResult;
		language?: string | null;
		lineNumbers?: boolean;
		startLine?: number;
		chalk?: ChalkInstance;
	}) => {
		const { highlighted } = useCode({ code, language });

		const lineNumberLength = String(
			startLine + highlighted.tokens.length - 1,
		).length;

		const color = (
			color?: CodeResult["tokens"][number][number] | string | undefined,
		) => {
			if (typeof color === "object")
				color = (color.htmlStyle as { color?: string } | undefined)?.color;
			return color ? prechalk.hex(color.split(";")[0]) : prechalk;
		};

		return highlighted.tokens.map((line, lineIndex) => {
			const node = line.map((token) => color(token)(token.content));

			if (lineNumbers) {
				return (
					<Text key={lineIndex}>
						{chalk.gray(
							`${(lineIndex + startLine)
								.toString()
								.padStart(lineNumberLength, " ")}. `,
						)}
						{node}
					</Text>
				);
			}

			return node;
		});
	},
	(previous, next) =>
		previous.code === next.code && previous.language === next.language,
);
