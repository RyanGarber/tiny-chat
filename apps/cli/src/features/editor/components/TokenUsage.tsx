import { useDraftStore } from "@tiny-chat/client/src/features/chat/stores/useDraftStore.ts";
import { useEstimatedTokens } from "@tiny-chat/client/src/features/editor/hooks/useEstimatedTokens.ts";
import Spinner from "ink-spinner";
import { useState } from "react";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import type { Color } from "../../../core/hooks/useColor.ts";
import { useMouseInput } from "../../../core/hooks/useMouseInput.ts";

export default function TokenUsage() {
	// Estimated against what the message will actually carry: an atom stands for
	// far more than the few characters it takes up in the editor.
	const data = useDraftStore((state) => state.data);

	const { categories, totalUsage } = useEstimatedTokens<Color>({
		data,
		colors: { low: "primary", moderate: "yellowBright", high: "redBright" },
	});

	const [expanded, setExpanded] = useState(false);

	const [hovered, setHovered] = useState(false);
	const { mouseRef } = useMouseInput({
		onHoverStart: () => setHovered(true),
		onHoverEnd: () => setHovered(false),
		onClick: () => setExpanded(!expanded),
	});

	return (
		<Box
			ref={mouseRef}
			flexDirection="column"
			justifyContent="flex-end"
			alignItems="flex-end"
			flexShrink={0}
			position={expanded ? "absolute" : undefined}
			bottom={0}
			right={0}
			backgroundColor={expanded ? "interior" : undefined}
			paddingX={expanded ? 2 : 0}
			paddingY={expanded ? 1 : 0}
			minWidth={5}
		>
			<Box>
				<Box flexDirection="column" alignItems="flex-end">
					{expanded &&
						categories.map((category) => (
							<Text key={category.name} bold>
								{category.name.toLowerCase()}:{" "}
							</Text>
						))}
					{expanded && (
						<Text bold color={totalUsage.color} dimColor={hovered}>
							total:{" "}
						</Text>
					)}
				</Box>
				<Box flexDirection="column" alignItems="flex-end">
					{expanded &&
						categories.map((category) => (
							<Text key={category.name}>
								{category.loading && <Spinner type="dots" />}
								{!category.loading &&
									Math.round(category.tokens).toLocaleString()}
							</Text>
						))}
					<Text color={totalUsage.color} dimColor={hovered}>
						{totalUsage.loading && <Spinner type="dots" />}
						{!totalUsage.loading && `${Math.round(totalUsage.percent)}%`}
					</Text>
				</Box>
			</Box>
		</Box>
	);
}
