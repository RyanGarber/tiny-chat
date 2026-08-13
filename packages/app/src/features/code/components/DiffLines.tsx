/** biome-ignore-all lint/suspicious/noArrayIndexKey: code stays in order */

import { Box, Button, Group } from "@mantine/core";
import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import { CodeUtils } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { DiffUtils } from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import {
	type Dispatch,
	memo,
	type ReactNode,
	type SetStateAction,
} from "react";
import CodeLines from "#app/features/code/components/CodeLines.tsx";

const DiffLines = memo(
	({
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
			<div key={index}>
				{change.type === "unchanged" &&
					expanded.includes(index) &&
					change.lines.map((line, lineIndex) => (
						<Block key={lineIndex} type={change.type} expanded>
							<div style={{ flex: 1 }}>
								<CodeLines
									code={line}
									language={language}
									lineNumbers={false}
								/>
							</div>
						</Block>
					))}
				{(change.type !== "unchanged" || !expanded.includes(index)) && (
					<Block key={index} type={change.type}>
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
							<div style={{ flex: 1 }}>
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
							</div>
						)}
					</Block>
				)}
			</div>
		));
	},
	(previous, next) =>
		previous.diff === next.diff &&
		previous.expanded === next.expanded &&
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
	language: string;
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

	return change.parts.map((part, partIndex) => {
		let node: ReactNode;

		if (part.type === "changed") {
			const bStart = beforeOffset;
			const aStart = afterOffset;
			beforeOffset += part.partBefore.length;
			afterOffset += part.partAfter.length;
			node = (
				<span style={{ backgroundColor: DiffUtils.color("changed") }}>
					<span
						style={{
							backgroundColor: DiffUtils.color("removed"),
							padding: "2px 4px",
						}}
					>
						<CodeLines
							code={CodeUtils.extractTokenRange(beforeHL, bStart, beforeOffset)}
							lineNumbers={false}
						/>
					</span>
					<span
						style={{
							backgroundColor: DiffUtils.color("added"),
							padding: "2px 4px",
						}}
					>
						<CodeLines
							code={CodeUtils.extractTokenRange(afterHL, aStart, afterOffset)}
							lineNumbers={false}
						/>
					</span>
				</span>
			);
		} else if (part.type === "removed") {
			const bStart = beforeOffset;
			beforeOffset += part.part.length;
			node = (
				<span
					style={{
						backgroundColor: DiffUtils.color("removed"),
						padding: "2px 0",
					}}
				>
					<CodeLines
						code={CodeUtils.extractTokenRange(beforeHL, bStart, beforeOffset)}
						lineNumbers={false}
					/>
				</span>
			);
		} else if (part.type === "added") {
			const aStart = afterOffset;
			afterOffset += part.part.length;
			node = (
				<span
					style={{
						backgroundColor: DiffUtils.color("added"),
						padding: "2px 0",
					}}
				>
					<CodeLines
						code={CodeUtils.extractTokenRange(afterHL, aStart, afterOffset)}
						lineNumbers={false}
					/>
				</span>
			);
		} else {
			// unchanged — use before tokens (both sides are identical)
			const bStart = beforeOffset;
			beforeOffset += part.part.length;
			afterOffset += part.part.length;
			node = (
				<span style={{ padding: "2px 0" }}>
					<CodeLines
						code={CodeUtils.extractTokenRange(beforeHL, bStart, beforeOffset)}
						lineNumbers={false}
					/>
				</span>
			);
		}

		return <span key={partIndex}>{node}</span>;
	});
}

function Block({
	children,
	type,
	expanded,
}: {
	children: ReactNode;
	type: ReturnType<typeof DiffUtils.context>[number]["type"];
	expanded?: boolean;
}) {
	return (
		<Group
			gap={0}
			align="flex-start"
			wrap="nowrap"
			miw="100%"
			bg={DiffUtils.color(type)}
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
}
