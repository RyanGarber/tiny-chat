/** biome-ignore-all lint/suspicious/noArrayIndexKey: nodes stay in order */

import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import { DiffUtils } from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import { Box, Text } from "ink";
import { useMemo } from "react";

export const Code = ({
	//filename,
	language,
	code,
	//startLine = 1,
	//lineNumbers = true,
	maxHeight,
	marginBottom = 0,
}: {
	filename?: string;
	code: string;
	language?: string | null;
	startLine?: number;
	lineNumbers?: boolean;
	maxHeight?: number;
	marginBottom?: number;
}) => {
	const codeShown = code.slice(0, maxHeight);
	const overflow = code.length - codeShown.length;

	const { highlighted } = useCode({ code, language: language ?? null });

	return (
		<Box flexDirection="column" marginBottom={marginBottom}>
			{highlighted.tokens.map((line, lineNumber) => (
				<Text key={lineNumber}>
					{line.map((token, tokenIndex) => (
						<Text
							key={tokenIndex}
							color={(token.htmlStyle as { color?: string } | undefined)?.color}
						>
							{token.content}
						</Text>
					))}
				</Text>
			))}
			{overflow > 0 && <Text dimColor>{` ⋮ ${overflow} more lines`}</Text>}
		</Box>
	);
};

export const Diff = ({
	before,
	after,
	maxHeight,
}: {
	before: string;
	after: string;
	maxHeight?: number;
}) => {
	const diff = useMemo(
		() =>
			DiffUtils.context(
				DiffUtils.diff({
					before,
					after,
				}),
			),
		[before, after],
	);

	const diffShown = diff.slice(0, maxHeight);
	const overflow = diff.length - diffShown.length;

	return (
		<Box flexDirection="column">
			{diffShown.map((change, index) => {
				if (change.type === "unchanged") {
					return (
						<Text key={index} dimColor>
							{` ⋮ ${change.lines.length} unchanged line${change.lines.length === 1 ? "" : "s"}`}
						</Text>
					);
				}

				if (change.type === "changed") {
					return (
						<Text key={index}>
							{"~ "}
							{change.parts.map((part, partIndex) => {
								if (part.type === "changed") {
									return (
										<Text key={partIndex}>
											<Text color="red" underline>
												{part.partBefore}
											</Text>
											<Text color="green" underline>
												{part.partAfter}
											</Text>
										</Text>
									);
								}

								return (
									<Text
										key={partIndex}
										color={
											part.type === "added"
												? "green"
												: part.type === "removed"
													? "red"
													: undefined
										}
									>
										{part.part}
									</Text>
								);
							})}
						</Text>
					);
				}

				return (
					<Text
						key={index}
						color={
							change.type === "added"
								? "green"
								: change.type === "removed"
									? "red"
									: undefined
						}
					>
						{change.type === "added"
							? "+ "
							: change.type === "removed"
								? "- "
								: "  "}
						{change.line}
					</Text>
				);
			})}
			{overflow > 0 && <Text dimColor>{` ⋮ ${overflow} more lines`}</Text>}
		</Box>
	);
};
