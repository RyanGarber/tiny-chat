/** biome-ignore-all lint/suspicious/noArrayIndexKey: code stays in order */

import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import type { CodeResult } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { memo } from "react";

const CodeLines = memo(
	({
		code,
		language,
		lineNumbers,
	}: {
		code: string | CodeResult;
		language?: string | null;
		lineNumbers: boolean;
	}) => {
		const { highlighted } = useCode({ code, language });

		return highlighted.tokens.map((line, lineIndex) => (
			<span
				className={
					lineNumbers
						? "block before:content-[counter(line)] before:inline-block before:[counter-increment:line] before:w-6 before:mr-4 before:text-[13px] before:text-right before:text-muted-foreground/50 before:font-mono before:select-none"
						: undefined
				}
				key={lineIndex}
			>
				{line.length === 0 || (line.length === 1 && line[0].content === "")
					? "\n"
					: line.map((token, tokenIndex) => {
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
									key={tokenIndex}
									style={tokenStyle}
									{...token.htmlAttrs}
								>
									{token.content}
								</span>
							);
						})}
			</span>
		));
	},
	(previous, next) =>
		previous.code === next.code &&
		previous.language === next.language &&
		previous.lineNumbers === next.lineNumbers,
);

export default CodeLines;
