/** biome-ignore-all lint/suspicious/noArrayIndexKey: code stays in order */

import { Box, Button, Group } from "@mantine/core";
import { useCode } from "@tiny-chat/client/src/core/hooks/useCode.ts";
import { CodeUtils } from "@tiny-chat/core/src/core/utils/CodeUtils.ts";
import { DiffUtils } from "@tiny-chat/core/src/features/file/utils/DiffUtils.ts";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import CodeLines from "#app/features/code/components/CodeLines.tsx";

export default function DiffLines({
	diff,
	expanded,
	setExpanded,
	language,
}: {
	diff: ReturnType<typeof DiffUtils.context>;
	expanded: number[];
	setExpanded: Dispatch<SetStateAction<number[]>>;
	language: string;
}) {
	return diff.flatMap((change, index) => (
		<div key={index}>
			{change.type === "unchanged" &&
				expanded.includes(index) &&
				change.lines.map((line, lineIndex) => (
					<Block key={lineIndex} type={change.type} expanded>
						<div style={{ flex: 1 }}>
							<CodeLines code={line} language={language} lineNumbers={false} />
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
}

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
					<span style={{ backgroundColor: DiffUtils.color("changed") }}>
						<span
							style={{
								backgroundColor: DiffUtils.color("removed"),
								padding: "2px 4px",
							}}
						>
							<CodeLines
								code={CodeUtils.extractTokenRange(
									beforeHL,
									bStart,
									nextBeforeOffset,
								)}
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
								code={CodeUtils.extractTokenRange(
									afterHL,
									aStart,
									nextAfterOffset,
								)}
								lineNumbers={false}
							/>
						</span>
					</span>
				);
			} else if (part.type === "removed") {
				const bStart = beforeOffset;
				nextBeforeOffset += part.part.length;
				node = (
					<span
						style={{
							backgroundColor: DiffUtils.color("removed"),
							padding: "2px 0",
						}}
					>
						<CodeLines
							code={CodeUtils.extractTokenRange(
								beforeHL,
								bStart,
								nextBeforeOffset,
							)}
							lineNumbers={false}
						/>
					</span>
				);
			} else if (part.type === "added") {
				const aStart = afterOffset;
				nextAfterOffset += part.part.length;
				node = (
					<span
						style={{
							backgroundColor: DiffUtils.color("added"),
							padding: "2px 0",
						}}
					>
						<CodeLines
							code={CodeUtils.extractTokenRange(
								afterHL,
								aStart,
								nextAfterOffset,
							)}
							lineNumbers={false}
						/>
					</span>
				);
			} else {
				// unchanged — use before tokens (both sides are identical)
				const bStart = beforeOffset;
				nextBeforeOffset += part.part.length;
				nextAfterOffset += part.part.length;
				node = (
					<span style={{ padding: "2px 0" }}>
						<CodeLines
							code={CodeUtils.extractTokenRange(
								beforeHL,
								bStart,
								nextBeforeOffset,
							)}
							lineNumbers={false}
						/>
					</span>
				);
			}

			return {
				nodes: [...accumulator.nodes, <span key={partIndex}>{node}</span>],
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
