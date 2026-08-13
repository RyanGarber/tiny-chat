import { Icon } from "@iconify/react";
import { Box, Collapse, Group, Text } from "@mantine/core";
import type { MarkdownContext } from "@tiny-chat/client/src/features/message/components/MarkdownContext.tsx";
import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { memo, useMemo, useState } from "react";
import { Markdown } from "../../message/components/Markdown.tsx";

export const Thought = memo(
	({
		thoughts,
		context,
		textSize,
	}: {
		thoughts: Extract<RenderedPart, { type: "thought" }>[];
		context: MarkdownContext<string>;
		textSize?: NonNullable<MarkdownContext<string>["style"]>["textSize"];
	}) => {
		const pending = thoughts.some((thought) => thought.active);

		const thoughtText = useMemo(
			() => thoughts.map((t) => t.value).join("\n\n"),
			[thoughts],
		);

		const thoughtContext = useMemo<typeof context>(
			() => ({ ...context, streaming: pending, style: { textSize } }),
			[context, pending, textSize],
		);

		const [expanded, setExpanded] = useState(false);

		return (
			<Box my={10}>
				<Group
					className={`shimmer-text ${pending ? "active" : ""}`}
					onClick={() => setExpanded(!expanded)}
					style={{ cursor: "pointer" }}
					gap="xs"
				>
					<Icon
						icon="lucide:brain"
						height={18}
						color="var(--mantine-color-dimmed)"
					/>
					<Text truncate="end">{pending ? "Thinking..." : "Thought"}</Text>
				</Group>
				<Collapse expanded={expanded}>
					<Box
						style={{
							borderLeft: "2px solid var(--mantine-color-default-border)",
						}}
						px="lg"
						py="xs"
						ml={8}
					>
						<Markdown source={thoughtText} context={thoughtContext} />
					</Box>
				</Collapse>
			</Box>
		);
	},
	(previous, next) =>
		previous.thoughts.every(
			(thought, i) =>
				next.thoughts[i].value === thought.value &&
				next.thoughts[i].active === thought.active,
		) &&
		previous.context.streaming === next.context.streaming &&
		previous.textSize === next.textSize,
);
