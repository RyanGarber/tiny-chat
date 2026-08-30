/** biome-ignore-all lint/suspicious/noArrayIndexKey: lines stay in order */

import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import {
	type CodeResult,
	CodeUtils,
} from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import {
	type DiffContext,
	DiffUtils,
} from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import chalk from "chalk";
import { Text } from "ink";
import type { ReactNode } from "react";
import CodeLines from "./CodeLines.tsx";

export default function DiffLines({
	diff,
	highlighted,
	language = null,
}: {
	diff: ReturnType<typeof DiffUtils.context>;
	highlighted: CodeResult;
	language: string | null | undefined;
}) {
	return diff.map((change, index) => (
		<Block key={index} type={change.type} highlighted={highlighted}>
			{change.type === "unchanged" &&
				` ⋮ ${change.lines.length} unchanged line${change.lines.length === 1 ? "" : "s"}`}
			{change.type !== "unchanged" && (
				<>
					{change.type === "changed" && (
						<ChangedLines change={change} language={language} />
					)}
					{change.type !== "changed" && (
						<CodeLines
							code={change.line}
							language={language}
							lineNumbers={false}
						/>
					)}
				</>
			)}
		</Block>
	));
}

function ChangedLines({
	change,
	language,
}: {
	change: Extract<
		ReturnType<typeof DiffUtils.context>[number],
		{ type: "changed" }
	>;
	language: string | null;
}) {
	const { highlighted: beforeHL } = useCode({
		code: change.lineBefore,
		language,
	});
	const { highlighted: afterHL } = useCode({
		code: change.lineAfter,
		language,
	});

	const bgColor = (type: DiffContext["type"], highlighted: CodeResult) => {
		const color = DiffUtils.color(type, highlighted);
		const hex = color?.split(";")[0];
		return hex ? chalk.bgHex(hex) : chalk;
	};

	return change.parts.reduce<{
		nodes: ReactNode[];
		beforeOffset: number;
		afterOffset: number;
	}>(
		(accumulator, part, partIndex) => {
			const { beforeOffset, afterOffset } = accumulator;
			let nextBeforeOffset = beforeOffset;
			let nextAfterOffset = afterOffset;
			let node: ReactNode;

			if (part.type === "changed") {
				const bStart = beforeOffset;
				const aStart = afterOffset;
				nextBeforeOffset += part.partBefore.length;
				nextAfterOffset += part.partAfter.length;
				node = (
					<Text backgroundColor={DiffUtils.color("changed", beforeHL)}>
						<CodeLines
							code={CodeUtils.extractTokenRange(
								beforeHL,
								bStart,
								nextBeforeOffset,
							)}
							language={language}
							lineNumbers={false}
							chalk={bgColor("removed", beforeHL)}
						/>
						<CodeLines
							code={CodeUtils.extractTokenRange(
								afterHL,
								aStart,
								nextAfterOffset,
							)}
							language={language}
							lineNumbers={false}
							chalk={bgColor("added", afterHL)}
						/>
					</Text>
				);
			} else if (part.type === "removed") {
				const bStart = beforeOffset;
				nextBeforeOffset += part.part.length;
				const tokens = CodeUtils.extractTokenRange(
					beforeHL,
					bStart,
					nextBeforeOffset,
				);
				node = (
					<CodeLines
						code={tokens}
						language={language}
						lineNumbers={false}
						chalk={bgColor("removed", beforeHL)}
					/>
				);
			} else if (part.type === "added") {
				const aStart = afterOffset;
				nextAfterOffset += part.part.length;
				const tokens = CodeUtils.extractTokenRange(
					afterHL,
					aStart,
					nextAfterOffset,
				);
				node = (
					<CodeLines
						code={tokens}
						language={language}
						lineNumbers={false}
						chalk={bgColor("added", afterHL)}
					/>
				);
			} else {
				const bStart = beforeOffset;
				nextBeforeOffset += part.part.length;
				nextAfterOffset += part.part.length;
				node = (
					<CodeLines
						code={CodeUtils.extractTokenRange(
							beforeHL,
							bStart,
							nextBeforeOffset,
						)}
						language={language}
						lineNumbers={false}
					/>
				);
			}

			return {
				nodes: [...accumulator.nodes, <Text key={partIndex}>{node}</Text>],
				beforeOffset: nextBeforeOffset,
				afterOffset: nextAfterOffset,
			};
		},
		{ nodes: [], beforeOffset: 0, afterOffset: 0 },
	).nodes;
}

function Block({
	children,
	type,
	highlighted,
}: {
	children: ReactNode;
	type: DiffContext["type"];
	highlighted: CodeResult;
}) {
	const backgroundColor = DiffUtils.color(type, highlighted);
	return (
		<Text backgroundColor={backgroundColor}>
			{type === "removed" && "-"}
			{type === "added" && "+"}
			{type === "changed" && "~"}
			{type === "unchanged" || (type === "context" && " ")}
			{` `}
			{children}
		</Text>
	);
}
