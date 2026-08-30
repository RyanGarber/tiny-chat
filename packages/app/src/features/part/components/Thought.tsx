import { Box, Collapse, Group, Text } from "@mantine/core";
import { BrainIcon } from "@phosphor-icons/react";
import type { RenderedPart } from "@tiny-chat/core/src/features/data/utils/DataUtils.ts";
import { useState } from "react";
import Markdown from "../../message/components/Markdown.tsx";

export default function Thought({
	thoughts,
}: {
	thoughts: Extract<RenderedPart, { type: "thought" }>[];
}) {
	const pending = thoughts.some((thought) => thought.active);

	const thoughtText = thoughts.map((thought) => thought.value).join("\n\n");

	const [expanded, setExpanded] = useState(false);

	return (
		<Box my={10}>
			<Group
				className={`shimmer-text ${pending ? "active" : ""}`}
				onClick={() => setExpanded(!expanded)}
				style={{ cursor: "pointer" }}
				gap="xs"
			>
				<BrainIcon size={20} color="var(--mantine-color-dimmed)" />
				<Text truncate="end" flex={1}>
					{pending ? "Thinking..." : "Thought"}
				</Text>
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
					<div style={{ zoom: 0.9 }}>
						<Markdown source={thoughtText} streaming={pending} />
					</div>{" "}
				</Box>
			</Collapse>
		</Box>
	);
}
