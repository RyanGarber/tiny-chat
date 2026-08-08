import { useEstimatedTokens } from "@tiny-chat/client/src/features/editor/hooks/useEstimatedTokens.ts";
import type { ColorName } from "chalk";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { useState } from "react";
import { useEditorStore } from "../stores/useEditorStore.ts";

export default function TokenUsage() {
	const content = useEditorStore((state) => state.content);

	const { categories, totalUsage } = useEstimatedTokens<ColorName>({
		data: [[{ type: "text", value: content }]],
		colors: { low: "blueBright", moderate: "yellowBright", high: "redBright" },
	});

	const [expanded, setExpanded] = useState(false);

	useInput((input, key) => {
		if (key.ctrl && input === "r") {
			setExpanded(!expanded);
		}
	});

	return (
		<Box flexDirection="column" alignItems="flex-end" gap={1} flexShrink={0}>
			{expanded && (
				<Box flexDirection="column" borderStyle="round" borderColor="gray">
					{categories.map((category) => (
						<Box key={category.name} justifyContent="space-between" gap={1}>
							<Text bold>{category.name.toLowerCase()}: </Text>
							<Text>
								{category.loading ? (
									<Spinner type="dots" />
								) : (
									Math.round(category.tokens).toLocaleString()
								)}
							</Text>
						</Box>
					))}
				</Box>
			)}
			<Text color={totalUsage.color}>
				{totalUsage.loading ? (
					<Spinner type="dots" />
				) : (
					`${Math.round(totalUsage.percent)}%`
				)}
			</Text>
		</Box>
	);
}
