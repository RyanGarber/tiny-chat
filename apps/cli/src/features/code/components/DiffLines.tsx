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
import { memo, type ReactNode } from "react";
import { CodeLines } from "./CodeLines.tsx";

const DiffLines = memo(
	({
		diff,
		highlighted,
		language = null,
	}: {
		diff: ReturnType<typeof DiffUtils.context>;
		highlighted: CodeResult;
		language: string | null | undefined;
	}) => {
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
	},
	(previous, next) =>
		previous.diff === next.diff &&
		previous.highlighted === next.highlighted &&
		previous.language === next.language,
);
export default DiffLines;

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

	let beforeOffset = 0;
	let afterOffset = 0;

	const bgColor = (type: DiffContext["type"], highlighted: CodeResult) => {
		const color = DiffUtils.color(type, highlighted);
		const hex = color?.split(";")[0];
		return hex ? chalk.bgHex(hex) : chalk;
	};

	return change.parts.map((part, partIndex) => {
		let node: ReactNode;

		if (part.type === "changed") {
			const bStart = beforeOffset;
			const aStart = afterOffset;
			beforeOffset += part.partBefore.length;
			afterOffset += part.partAfter.length;
			node = (
				<Text backgroundColor={DiffUtils.color("changed", beforeHL)}>
					<CodeLines
						code={CodeUtils.extractTokenRange(beforeHL, bStart, beforeOffset)}
						language={language}
						lineNumbers={false}
						chalk={bgColor("removed", beforeHL)}
					/>
					<CodeLines
						code={CodeUtils.extractTokenRange(afterHL, aStart, afterOffset)}
						language={language}
						lineNumbers={false}
						chalk={bgColor("added", afterHL)}
					/>
				</Text>
			);
		} else if (part.type === "removed") {
			const bStart = beforeOffset;
			beforeOffset += part.part.length;
			const tokens = CodeUtils.extractTokenRange(
				beforeHL,
				bStart,
				beforeOffset,
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
			afterOffset += part.part.length;
			const tokens = CodeUtils.extractTokenRange(afterHL, aStart, afterOffset);
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
			beforeOffset += part.part.length;
			afterOffset += part.part.length;
			node = (
				<CodeLines
					code={CodeUtils.extractTokenRange(beforeHL, bStart, beforeOffset)}
					language={language}
					lineNumbers={false}
				/>
			);
		}

		return <Text key={partIndex}>{node}</Text>;
	});
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
