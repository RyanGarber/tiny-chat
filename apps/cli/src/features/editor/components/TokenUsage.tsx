import { useEstimatedTokens } from "@tiny-chat/client/src/features/editor/hooks/useEstimatedTokens.ts";
import { useAtomStore } from "@tiny-chat/client/src/features/editor/stores/useAtomStore.ts";
import { AtomUtils } from "@tiny-chat/client/src/features/editor/utils/AtomUtils.ts";
import { useInput } from "ink";
import Spinner from "ink-spinner";
import { useMemo, useState } from "react";
import Box from "../../../core/components/Box.tsx";
import Text from "../../../core/components/Text.tsx";
import type { Color } from "../../../core/hooks/useColor.ts";
import { useEditorStore } from "../stores/useEditorStore.ts";

export default function TokenUsage() {
	const content = useEditorStore((state) => state.content);
	const atoms = useAtomStore((state) => state.atoms);

	// Estimated against what the message will actually carry: an atom stands for
	// far more than the few characters it takes up in the editor.
	const data = useMemo(
		() => [
			[
				{
					type: "text" as const,
					value: AtomUtils.serialize({ content, atoms }),
				},
			],
		],
		[content, atoms],
	);

	const { categories, totalUsage } = useEstimatedTokens<Color>({
		data,
		colors: { low: "primary", moderate: "yellowBright", high: "redBright" },
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
			backgroundColor={expanded ? "interior" : undefined}
			paddingX={expanded ? 2 : 0}
			paddingY={expanded ? 1 : 0}
			minWidth={5}
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
			<Box
				width={expanded ? "100%" : undefined}
				justifyContent="space-between"
				gap={1}
				color={totalUsage.color}
			>
				{expanded && <Text bold>total: </Text>}
				<Text>
					{totalUsage.loading && <Spinner type="dots" />}
					{!totalUsage.loading && `${Math.round(totalUsage.percent)}%`}
				</Text>
			</Box>
		</Box>
	);
}
