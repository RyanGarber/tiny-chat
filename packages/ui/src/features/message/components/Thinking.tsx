import { Icon } from "@iconify/react";
import { Box, Collapse, Group, Text } from "@mantine/core";
import { memo, useMemo, useState } from "react";
import type { MarkdownContext } from "#ui/utils/data.ts";
import { Markdown } from "./Markdown";

const FZ = "14px";

export const Thinking = memo(
	({
		thoughts,
		isThinking,
		context,
	}: {
		thoughts: string[];
		isThinking: boolean;
		context: MarkdownContext;
	}) => {
		const thinkingContext = useMemo(
			() => ({ ...context, isGenerating: isThinking }),
			[context, isThinking],
		);
		const thinkingText = useMemo(() => thoughts.join("\n\n"), [thoughts]);

		const [expanded, setExpanded] = useState(false);

		return (
			<Box my={10}>
				<Group
					className={`shimmer-text ${isThinking ? "active" : ""}`}
					onClick={() => setExpanded(!expanded)}
					style={{ cursor: "pointer" }}
					gap="xs"
				>
					<Icon
						icon="lucide:brain"
						height={18}
						color="var(--mantine-color-dimmed)"
					/>
					<Text truncate="end" fz={FZ}>
						{isThinking ? "Thinking..." : "Thought"}
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
						<Markdown source={thinkingText} context={thinkingContext} />
					</Box>
				</Collapse>
			</Box>
		);
	},
);
