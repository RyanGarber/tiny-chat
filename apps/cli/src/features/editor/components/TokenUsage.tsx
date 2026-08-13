import { ThemeContext } from "@tiny-chat/client/src/core/components/ThemeContext.tsx";
import { useEstimatedTokens } from "@tiny-chat/client/src/features/editor/hooks/useEstimatedTokens.ts";
import type { ColorName } from "chalk";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { useContext, useState } from "react";
import { useEditorStore } from "../stores/useEditorStore.ts";

export default function TokenUsage() {
	const { colorScheme } = useContext(ThemeContext);

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
		<Box
			flexDirection="column"
			alignItems="flex-end"
			flexShrink={0}
			backgroundColor={colorScheme.interior}
			paddingX={expanded ? 2 : 0}
			paddingY={expanded ? 1 : 0}
		>
			{expanded && (
				<Box flexDirection="column">
					{categories.map((category) => (
						<Box key={category.name} justifyContent="space-between" gap={1}>
							<Text bold>{category.name.toLowerCase()}: </Text>
							<Text>
								{category.loading && <Spinner type="dots" />}
								{!category.loading &&
									Math.round(category.tokens).toLocaleString()}
							</Text>
						</Box>
					))}
				</Box>
			)}
			<Box width="100%" justifyContent="space-between" gap={1}>
				{expanded && (
					<Text color={totalUsage.color} bold>
						total:{" "}
					</Text>
				)}
				<Text color={totalUsage.color}>
					{totalUsage.loading && <Spinner type="dots" />}
					{!totalUsage.loading && `${Math.round(totalUsage.percent)}%`}
				</Text>
			</Box>
		</Box>
	);
}
